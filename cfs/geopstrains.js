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
var ZURICH_BBOX = 'BBOX 920000 5997000 980000 6013000 12 rail';
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

function handleMessage(msg, lastPost, onPosition) {
    if (!msg || !msg.source) {
        return;
    }
    if (msg.source === 'buffer' && Array.isArray(msg.content)) {
        msg.content.forEach(function (item) {
            if (item) {
                handleMessage(item, lastPost, onPosition);
            }
        });
        return;
    }
    if (msg.source.indexOf('deleted') === 0) {
        return;
    }
    if (msg.source.indexOf('trajectory') === 0 && msg.content) {
        onPosition(trajectory.positionFromFeature(msg.content), lastPost);
    }
}

function postPosition(doc, lastPost) {
    var now = Date.now(),
        prev;

    if (!doc || !doc.train_id) {
        return;
    }
    prev = lastPost.get(doc.train_id);
    if (prev && (now - prev) < POST_THROTTLE_MS) {
        return;
    }
    lastPost.set(doc.train_id, now);
    ingest.postDocuments(COLLECTION_ID, doc);
}

function connect() {
    var ws,
        timeout,
        pingTimer,
        lastPost = new Map(),
        tickCount = 0;

    if (!process.env.GEOPS_API_KEY) {
        log('warn', 'geopstrains - GEOPS_API_KEY not set; demo ingest disabled.');
        return;
    }

    log('info', 'geopstrains - connecting to geOps tracker.');

    ws = new WebSocket(wsUrl());

    ws.on('open', function () {
        log('info', 'geopstrains - WebSocket open, subscribing Zurich rail.');
        ws.send(ZURICH_BBOX);
        pingTimer = setInterval(function () {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send('PING');
            }
        }, 25000);
    });

    ws.on('message', function (data) {
        var msg;
        try {
            msg = JSON.parse(data);
        } catch (e) {
            return;
        }
        handleMessage(msg, lastPost, function (doc, map) {
            if (!doc) {
                return;
            }
            postPosition(doc, map);
            tickCount = tickCount + 1;
            if (tickCount % 200 === 0) {
                log('debug', 'geopstrains - posted ' + tickCount + ' positions.');
            }
        });
    });

    ws.on('error', function (err) {
        log('error', 'geopstrains - ' + err);
        clearInterval(pingTimer);
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(connect, RECONNECT_MS);
    });

    ws.on('close', function () {
        log('warn', 'geopstrains - WebSocket closed.');
        clearInterval(pingTimer);
        if (timeout) {
            clearTimeout(timeout);
        }
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

module.exports = Geopstrains;
