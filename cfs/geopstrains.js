// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0

// geopstrains.js — geOps Realtime WebSocket ingest for Zurich train heatmap demo.
// Requires GEOPS_API_KEY (https://developer.geops.io/apis/realtime/).
// Set ENABLE_ZURICH_DEMO=false to disable.
/*jslint node: true, white: true, nomen: true */
"use strict";
var WebSocket = require('ws');
var ingest = require('./rtdbIngest');
var trajectory = require('./geopsTrajectory');

var COLLECTION_ID = process.env.ZURICH_COLLECTION_ID ||
    '9a3f1c2e-4b5d-6e7f-8a9b-0c1d2e3f4a5b';
var GEOPS_WS = 'wss://api.geops.io/tracker-ws/v1/ws';
var ZURICH_BBOX = 'BBOX 920000 5997000 980000 6013000 12 tenant=sbb mots=rail';
var RECONNECT_MS = 60000;
var POST_THROTTLE_MS = 1500;

function Geopstrains() {
    return this;
}

function log(level, msg) {
    if (global.logger && global.logger.log) {
        global.logger.log(level, msg);
    }
}

function demoDisabled() {
    return process.env.ENABLE_ZURICH_DEMO === 'false';
}

function wsUrl() {
    var token = process.env.GEOPS_API_KEY,
        url = GEOPS_WS;
    if (token) {
        url += '?key=' + encodeURIComponent(token);
    }
    return url;
}

function handleMessage(msg, lastPost, onPosition, stats) {
    if (!msg || !msg.source) {
        return;
    }
    if (msg.source === 'buffer' && Array.isArray(msg.content)) {
        if (stats) {
            stats.buffers = stats.buffers + 1;
        }
        msg.content.forEach(function (item) {
            if (item) {
                handleMessage(item, lastPost, onPosition, stats);
            }
        });
        return;
    }
    if (msg.source.indexOf('deleted') === 0) {
        if (stats) {
            stats.deleted = stats.deleted + 1;
        }
        return;
    }
    if (msg.source.indexOf('trajectory') === 0 && msg.content) {
        var doc = trajectory.positionFromFeature(msg.content);
        if (stats) {
            stats.trajectories = stats.trajectories + 1;
            if (!doc) {
                stats.inactive = stats.inactive + 1;
            }
        }
        onPosition(doc, lastPost);
    }
}

function postPosition(doc, lastPost, stats) {
    var now = Date.now(),
        prev;

    if (!doc || !doc.train_id) {
        return;
    }
    prev = lastPost.get(doc.train_id);
    if (prev && (now - prev) < POST_THROTTLE_MS) {
        if (stats) {
            stats.throttled = stats.throttled + 1;
        }
        return;
    }
    lastPost.set(doc.train_id, now);
    ingest.postDocuments(COLLECTION_ID, doc, function (err, status) {
        if (err) {
            if (stats) {
                stats.postErrors = stats.postErrors + 1;
            }
            log('error', 'geopstrains - POST failed: ' + err);
            return;
        }
        if (status !== 201) {
            if (stats) {
                stats.postErrors = stats.postErrors + 1;
            }
            log('warn', 'geopstrains - POST returned HTTP ' + status);
            return;
        }
        if (stats) {
            stats.posted = stats.posted + 1;
            if (!stats.initialLogged) {
                stats.initialLogged = true;
                log('info', 'geopstrains - initial snapshot: ' +
                    stats.trajectories + ' trajectories, ' + stats.posted +
                    ' posted, ' + lastPost.size + ' trains.');
            } else if (stats.posted % 100 === 0) {
                log('info', 'geopstrains - posted ' + stats.posted +
                    ' positions (' + lastPost.size + ' trains).');
            }
        }
    });
}

function clearTimers(pingTimer, noDataTimer, reconnectTimer) {
    if (pingTimer) {
        clearInterval(pingTimer);
    }
    if (noDataTimer) {
        clearTimeout(noDataTimer);
    }
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
    }
}

function connect() {
    var ws,
        timeout,
        pingTimer,
        noDataTimer,
        lastPost = new Map(),
        stats = {
            buffers: 0,
            trajectories: 0,
            inactive: 0,
            deleted: 0,
            posted: 0,
            throttled: 0,
            postErrors: 0,
            initialLogged: false
        };

    if (!process.env.GEOPS_API_KEY) {
        log('warn', 'geopstrains - GEOPS_API_KEY not set; demo ingest disabled.');
        return;
    }

    log('info', 'geopstrains - connecting to geOps tracker.');

    ws = new WebSocket(wsUrl());

    ws.on('open', function () {
        log('info', 'geopstrains - WebSocket open, subscribing: ' + ZURICH_BBOX);
        ws.send(ZURICH_BBOX);
        pingTimer = setInterval(function () {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send('PING');
            }
        }, 25000);
        noDataTimer = setTimeout(function () {
            if (stats.trajectories === 0) {
                log('warn', 'geopstrains - no trajectory data after 30s; ' +
                    'check BBOX subscription (' + ZURICH_BBOX + ').');
            }
        }, 30000);
    });

    ws.on('message', function (data) {
        var msg;
        try {
            msg = JSON.parse(data);
        } catch (e) {
            return;
        }
        handleMessage(msg, lastPost, function (doc, map) {
            postPosition(doc, map, stats);
        }, stats);
    });

    ws.on('error', function (err) {
        log('error', 'geopstrains - ' + err);
        clearTimers(pingTimer, noDataTimer, timeout);
        timeout = setTimeout(connect, RECONNECT_MS);
    });

    ws.on('close', function () {
        log('warn', 'geopstrains - WebSocket closed.');
        clearTimers(pingTimer, noDataTimer, timeout);
        timeout = setTimeout(connect, RECONNECT_MS);
    });
}

function main() {
    if (demoDisabled()) {
        log('info', 'geopstrains - disabled (ENABLE_ZURICH_DEMO=false).');
        return;
    }
    setTimeout(connect, 12000);
}

if (process.env.NODE_ENV !== 'test') {
    main();
}

Geopstrains.connect = connect;
Geopstrains.handleMessage = handleMessage;
Geopstrains.postPosition = postPosition;
Geopstrains.main = main;
Geopstrains.COLLECTION_ID = COLLECTION_ID;
Geopstrains.ZURICH_BBOX = ZURICH_BBOX;

module.exports = Geopstrains;
