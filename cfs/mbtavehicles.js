// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0

// mbtavehicles.js — MBTA V3 SSE vehicle ingest for Boston crowding heatmap demo.
// Requires MBTA_API_KEY (https://api-v3.mbta.com/).
// Set ENABLE_BOSTON_DEMO=false to disable.
/*jslint node: true, white: true, nomen: true */
"use strict";
var EventSource = require('eventsource').EventSource;
var ingest = require('./rtdbIngest');
var mbta = require('./mbtaOccupancy');

var COLLECTION_ID = process.env.BOSTON_COLLECTION_ID ||
    'b1c2d3e4-f5a6-7890-abcd-ef1234567890';
var MBTA_VEHICLES_SSE = 'https://api-v3.mbta.com/vehicles';
var RECONNECT_MS = 60000;
var POST_THROTTLE_MS = 3000;

var activeSource = null;

function Mbtavehicles() {
    return this;
}

function log(level, msg) {
    if (global.logger && global.logger.log) {
        global.logger.log(level, msg);
    }
}

function demoDisabled() {
    return process.env.ENABLE_BOSTON_DEMO === 'false';
}

function postDocument(doc, lastPost, stats) {
    var now = Date.now(),
        prev;

    if (!doc || !doc.vehicle_id) {
        return;
    }
    prev = lastPost.get(doc.vehicle_id);
    if (prev && (now - prev) < POST_THROTTLE_MS) {
        return;
    }
    lastPost.set(doc.vehicle_id, now);
    ingest.postDocuments(COLLECTION_ID, doc);
    stats.posted = stats.posted + 1;
    if (stats.posted % 100 === 0) {
        log('debug', 'mbtavehicles - posted ' + stats.posted + ' crowding samples.');
    }
}

function handleVehicleResource(resource, lastPost, stats) {
    var doc = mbta.documentFromVehicle(resource);
    if (doc) {
        postDocument(doc, lastPost, stats);
    }
}

function connectSse(lastPost, stats) {
    var key = process.env.MBTA_API_KEY,
        source;

    if (!key) {
        log('warn', 'mbtavehicles - MBTA_API_KEY not set; demo ingest disabled.');
        return null;
    }

    if (activeSource) {
        activeSource.close();
    }

    source = new EventSource(
        MBTA_VEHICLES_SSE + '?api_key=' + encodeURIComponent(key)
    );
    activeSource = source;

    source.onopen = function () {
        log('info', 'mbtavehicles - MBTA vehicles SSE connected.');
    };

    source.addEventListener('reset', function (evt) {
        var list, i, crowding = 0;
        try {
            list = JSON.parse(evt.data);
            for (i = 0; i < list.length; i = i + 1) {
                if (mbta.documentFromVehicle(list[i])) {
                    crowding = crowding + 1;
                }
                handleVehicleResource(list[i], lastPost, stats);
            }
            log('info', 'mbtavehicles - reset: ' + list.length +
                ' vehicles, ' + crowding + ' with crowding data.');
        } catch (e) {
            log('error', 'mbtavehicles - reset: ' + e);
        }
    });

    source.addEventListener('add', function (evt) {
        try {
            handleVehicleResource(JSON.parse(evt.data), lastPost, stats);
        } catch (e) {
            log('debug', 'mbtavehicles - add: ' + e);
        }
    });

    source.addEventListener('update', function (evt) {
        try {
            handleVehicleResource(JSON.parse(evt.data), lastPost, stats);
        } catch (e) {
            log('debug', 'mbtavehicles - update: ' + e);
        }
    });

    source.onerror = function () {
        log('warn', 'mbtavehicles - SSE error, reconnecting.');
        source.close();
        activeSource = null;
        setTimeout(function () {
            connectSse(lastPost, stats);
        }, RECONNECT_MS);
    };

    return source;
}

function connect() {
    var lastPost = new Map(),
        stats = { posted: 0 };

    connectSse(lastPost, stats);
}

function main() {
    if (demoDisabled()) {
        log('info', 'mbtavehicles - disabled (ENABLE_BOSTON_DEMO=false).');
        return;
    }
    setTimeout(connect, 12000);
}

if (process.env.NODE_ENV !== 'test') {
    main();
}

Mbtavehicles.connect = connect;
Mbtavehicles.handleVehicleResource = handleVehicleResource;
Mbtavehicles.postDocument = postDocument;
Mbtavehicles.main = main;
Mbtavehicles.COLLECTION_ID = COLLECTION_ID;

module.exports = Mbtavehicles;
