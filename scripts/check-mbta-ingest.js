// Quick diagnostic: MBTA SSE + crowding filter + optional rtdb POST count
// Usage: node scripts/check-mbta-ingest.js
"use strict";
require('../lib/loadEnv').loadEnvFile('.env');
var EventSource = require('eventsource').EventSource;
// eventsource v4: use .EventSource, auth via ?api_key= (see cfs/mbtavehicles.js)
var mbta = require('../cfs/mbtaOccupancy');

var key = process.env.MBTA_API_KEY;
var stats = {
    total: 0,
    withCrowding: 0,
    posted: 0
};

if (!key) {
    console.error('MBTA_API_KEY not set in .env');
    process.exit(1);
}

console.log('Connecting to MBTA vehicles SSE…');

var source = new EventSource(
    'https://api-v3.mbta.com/vehicles?api_key=' + encodeURIComponent(key)
);

function scan(resource) {
    var doc;
    if (!resource || resource.type !== 'vehicle') {
        return;
    }
    stats.total = stats.total + 1;
    doc = mbta.documentFromVehicle(resource);
    if (doc) {
        stats.withCrowding = stats.withCrowding + 1;
    }
}

source.addEventListener('reset', function (evt) {
    var list = JSON.parse(evt.data), i;
    for (i = 0; i < list.length; i = i + 1) {
        scan(list[i]);
    }
    console.log('reset snapshot:', JSON.stringify(stats, null, 2));
    source.close();
    process.exit(0);
});

source.onerror = function () {
    console.error('SSE error — check API key and network');
    process.exit(2);
};

setTimeout(function () {
    console.error('timeout waiting for reset event');
    process.exit(3);
}, 30000);
