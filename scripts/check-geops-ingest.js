// Quick diagnostic: geOps WebSocket + trajectory parsing
// Usage: node scripts/check-geops-ingest.js
"use strict";
require('../lib/loadEnv').loadEnvFile('.env');
var WebSocket = require('ws');
var Geops = require('../cfs/geopstrains.js');
var trajectory = require('../cfs/geopsTrajectory.js');

var key = process.env.GEOPS_API_KEY;
var ZURICH_BBOX = Geops.ZURICH_BBOX;
var stats = {
    rawMessages: 0,
    bySource: {},
    trajectoryMsgs: 0,
    parsed: 0,
    active: 0,
    inactive: 0,
    posted: 0,
    throttled: 0
};
var lastPost = new Map();

if (!key) {
    console.error('GEOPS_API_KEY not set in .env');
    process.exit(1);
}

console.log('Connecting to geOps tracker…');

var ws = new WebSocket('wss://api.geops.io/tracker-ws/v1/ws?key=' + encodeURIComponent(key));

ws.on('open', function () {
    console.log('WebSocket open, sending:', ZURICH_BBOX);
    ws.send(ZURICH_BBOX);
});

ws.on('message', function (data) {
    var msg, src;
    stats.rawMessages = stats.rawMessages + 1;
    try {
        msg = JSON.parse(data);
    } catch (e) {
        console.log('non-JSON message:', String(data).slice(0, 120));
        return;
    }
    src = msg.source || '(none)';
    stats.bySource[src] = (stats.bySource[src] || 0) + 1;

    if (src.indexOf('trajectory') === 0 && msg.content) {
        stats.trajectoryMsgs = stats.trajectoryMsgs + 1;
        var doc = trajectory.positionFromFeature(msg.content);
        if (doc) {
            stats.parsed = stats.parsed + 1;
            stats.active = stats.active + 1;
        } else if (msg.content.properties && msg.content.properties.time_intervals) {
            stats.inactive = stats.inactive + 1;
        }
    }

    Geops.handleMessage(msg, lastPost, function (doc, map) {
        var prev, now = Date.now();
        if (!doc) {
            return;
        }
        prev = map.get(doc.train_id);
        if (prev && (now - prev) < 1500) {
            stats.throttled = stats.throttled + 1;
            return;
        }
        map.set(doc.train_id, now);
        stats.posted = stats.posted + 1;
    });

    if (stats.rawMessages <= 3) {
        console.log('sample message', stats.rawMessages, JSON.stringify(msg).slice(0, 500));
    }
});

ws.on('error', function (err) {
    console.error('WebSocket error:', err.message || err);
});

setTimeout(function () {
    console.log('\n--- stats after 20s ---');
    console.log(JSON.stringify(stats, null, 2));
    console.log('unique trains in throttle map:', lastPost.size);
    ws.close();
    process.exit(0);
}, 20000);
