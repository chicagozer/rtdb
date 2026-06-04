// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0

// dow30quotes.js — Finnhub WebSocket trade ingest for Dow 30 treemap demo.
// Requires FINNHUB_API_KEY (free tier: https://finnhub.io/).
// Set ENABLE_DOW30_DEMO=false to disable (e.g. production without a key).
/*jslint node: true, white: true, nomen: true */
"use strict";
var fs = require('fs');
var path = require('path');
var WebSocket = require('ws');
var ingest = require('./rtdbIngest');

var COLLECTION_ID = process.env.DOW30_COLLECTION_ID ||
    process.env.SP500_COLLECTION_ID ||
    '7c4e8a2b-9f1d-4e6a-b3c8-1d2e0f4a5b6c';
var BATCH_SIZE = 25;
var RECONNECT_MS = 60000;

function Dow30quotes() {
    return this;
}

function log(level, msg) {
    if (global.logger && global.logger.log) {
        global.logger.log(level, msg);
    }
}

function demoDisabled() {
    if (process.env.ENABLE_DOW30_DEMO === 'false') {
        return true;
    }
    if (process.env.ENABLE_SP500_DEMO === 'false') {
        return true;
    }
    return false;
}

function loadSymbols() {
    var file = path.join(__dirname, '..', 'data', 'dow30-symbols.json'),
        list = JSON.parse(fs.readFileSync(file, 'utf8'));
    return list;
}

function normalizeTrade(trade) {
    return {
        _ts: Date.now(),
        symbol: trade.s,
        p: trade.p,
        v: trade.v,
        t: trade.t
    };
}

function postTrade(doc) {
    ingest.postDocuments(COLLECTION_ID, doc);
}

function subscribeSymbols(ws, symbols) {
    var i = 0;

    function sendBatch() {
        var batch = symbols.slice(i, i + BATCH_SIZE);
        if (!batch.length) {
            return;
        }
        batch.forEach(function (sym) {
            ws.send(JSON.stringify({
                type: 'subscribe',
                symbol: sym
            }));
        });
        i += BATCH_SIZE;
        if (i < symbols.length) {
            setTimeout(sendBatch, 200);
        }
    }

    sendBatch();
}

function connect() {
    var token = process.env.FINNHUB_API_KEY,
        symbols, ws, timeout, tickCount = 0;

    if (!token) {
        log('warn', 'dow30quotes - FINNHUB_API_KEY not set; demo ingest disabled.');
        return;
    }

    symbols = loadSymbols();
    log('info', 'dow30quotes - subscribing to ' + symbols.length + ' symbols.');

    ws = new WebSocket('wss://ws.finnhub.io?token=' + token);

    ws.on('open', function () {
        log('info', 'dow30quotes - Finnhub WebSocket open.');
        subscribeSymbols(ws, symbols);
    });

    ws.on('message', function (data) {
        var msg, trades, i, doc;
        try {
            msg = JSON.parse(data);
        } catch (e) {
            return;
        }
        if (msg.type !== 'trade' || !msg.data) {
            return;
        }
        trades = msg.data;
        for (i = 0; i < trades.length; i = i + 1) {
            if (!trades[i].s) {
                continue;
            }
            doc = normalizeTrade(trades[i]);
            postTrade(doc);
            tickCount = tickCount + 1;
        }
        if (tickCount > 0 && tickCount % 500 === 0) {
            log('debug', 'dow30quotes - posted ' + tickCount + ' trades.');
        }
    });

    ws.on('error', function (err) {
        log('error', 'dow30quotes - ' + err);
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(connect, RECONNECT_MS);
    });

    ws.on('close', function () {
        log('warn', 'dow30quotes - Finnhub WebSocket closed.');
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(connect, RECONNECT_MS);
    });
}

function main() {
    if (demoDisabled()) {
        log('info', 'dow30quotes - disabled (ENABLE_DOW30_DEMO=false).');
        return;
    }
    setTimeout(connect, 12000);
}

if (process.env.NODE_ENV !== 'test') {
    main();
}

Dow30quotes.connect = connect;
Dow30quotes.loadSymbols = loadSymbols;
Dow30quotes.normalizeTrade = normalizeTrade;
Dow30quotes.main = main;

module.exports = Dow30quotes;
