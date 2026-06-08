// tweet.js — Bluesky Jetstream ingest for SSE Topics demo.
// Set ENABLE_BLUESKY_DEMO=false to disable.
/*jslint unparam: true, node: true, white: true, nomen: true */
/*jshint laxbreak: true */

"use strict";
var util = require('util'),
    WebSocket = require('ws'),
    fs = require('fs'),
    path = require('path');


var http = require('http');

function Tweet() {
    return this;
}

function demoDisabled() {
    return process.env.ENABLE_BLUESKY_DEMO === 'false';
}

function cleanup() {
    var uploadsDir = __dirname + '/../sampledb/collection/e38201e5-e928-44a9-a17e-3ad3fd0a3ba7/documents';

    fs.readdir(uploadsDir, function(err, files) {
        if (!files) {
            return;
        }
        files.forEach(function(file, index) {
            fs.stat(path.join(uploadsDir, file), function(err, stat) {
                var endTime, now;
                if (err) {
                    return;
                }
                now = new Date().getTime();
                endTime = new Date(stat.ctime).getTime() + 1800000;
                if (now > endTime) {
                    return fs.unlink(path.join(uploadsDir, file), function(err) {
                        return undefined;
                    });
                }
            });
        });
    });
}

function doPost(data) {

    var userString = JSON.stringify(data),
        headers = {
            'Content-Type': 'application/json; charset=utf-8'
        },
        options = {
            host: process.env.OPENSHIFT_NODEJS_IP || 'localhost',
            port: process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || process.env.VCAP_APP_PORT || 9001,
            path: '/db/collections/e38201e5-e928-44a9-a17e-3ad3fd0a3ba7/documents',
            method: 'POST',
            headers: headers
        },

        // Setup the request.  The options parameter is
        // the object we defined above.
        req = http.request(options, function(res) {
            res.setEncoding('utf-8');

            res.on('data', function(ignore) {
                return undefined;
            });

            res.on('end', function() {
                return undefined;
            });
        });

    req.on('error', function(ignore) {
        // not much we can do here
        return undefined;
    });

    req.write(userString);
    req.end();
}


var maxPerSec = parseFloat(process.env.BLUESKY_MAX_POSTS_PER_SEC || '10', 10);
var requireTopic = process.env.BLUESKY_REQUIRE_TOPIC !== 'false';
var allowedLangs = parseAllowedLangs();
var rateTokens = maxPerSec;
var rateLastRefillMs = Date.now();
var timeout;
var stats = {
    received: 0,
    posted: 0,
    skipNotCreate: 0,
    skipNoText: 0,
    skipNoTopic: 0,
    skipNoLang: 0,
    skipRateLimit: 0
};

if (isNaN(maxPerSec) || maxPerSec <= 0) {
    maxPerSec = 10;
    rateTokens = 10;
}

function parseAllowedLangs() {
    var raw = process.env.BLUESKY_LANGS, parts, i;
    if (raw === undefined || raw === null || raw === '') {
        return ['en'];
    }
    if (raw === '*' || raw.toLowerCase() === 'none' || raw.toLowerCase() === 'false') {
        return null;
    }
    parts = raw.split(',');
    for (i = 0; i < parts.length; i++) {
        parts[i] = parts[i].trim().toLowerCase();
    }
    return parts.filter(function (s) {
        return s.length > 0;
    });
}

function matchesLang(record) {
    var langs, i, j, lang, tag;
    if (!allowedLangs) {
        return true;
    }
    langs = record && record.langs;
    if (!langs || !langs.length) {
        return false;
    }
    for (i = 0; i < langs.length; i++) {
        lang = String(langs[i]).toLowerCase();
        for (j = 0; j < allowedLangs.length; j++) {
            tag = allowedLangs[j];
            if (lang === tag || lang.indexOf(tag + '-') === 0) {
                return true;
            }
        }
    }
    return false;
}

function matchesTopic(text) {
    return /#[\w\u0080-\uFFFF]+/i.test(text);
}

function takeRateToken() {
    var now = Date.now(), elapsed = (now - rateLastRefillMs) / 1000;
    if (elapsed > 0) {
        rateTokens = Math.min(maxPerSec, rateTokens + elapsed * maxPerSec);
        rateLastRefillMs = now;
    }
    if (rateTokens >= 1) {
        rateTokens -= 1;
        return true;
    }
    return false;
}

function ingestDecision(msg) {
    var text;
    if (!msg.commit || msg.commit.operation !== 'create') {
        return 'notCreate';
    }
    if (!msg.commit.record || !msg.commit.record.text) {
        return 'noText';
    }
    text = msg.commit.record.text;
    if (!matchesLang(msg.commit.record)) {
        return 'noLang';
    }
    if (requireTopic && !matchesTopic(text)) {
        return 'noTopic';
    }
    if (!takeRateToken()) {
        return 'rateLimit';
    }
    return 'post';
}

function shouldIngest(msg) {
    return ingestDecision(msg) === 'post';
}

function recordSkip(reason) {
    if (reason === 'notCreate') {
        stats.skipNotCreate += 1;
    } else if (reason === 'noText') {
        stats.skipNoText += 1;
    } else if (reason === 'noTopic') {
        stats.skipNoTopic += 1;
    } else if (reason === 'noLang') {
        stats.skipNoLang += 1;
    } else if (reason === 'rateLimit') {
        stats.skipRateLimit += 1;
    }
}

function logIngestStats() {
    var eligible = stats.posted + stats.skipRateLimit;
    global.logger.log('info', 'bluesky ingest: posted=' + stats.posted +
        ' eligible=' + eligible + ' rate_limited=' + stats.skipRateLimit +
        ' no_topic=' + stats.skipNoTopic + ' no_lang=' + stats.skipNoLang +
        ' not_create=' + stats.skipNotCreate + ' no_text=' + stats.skipNoText +
        ' received=' + stats.received);
    stats.received = 0;
    stats.posted = 0;
    stats.skipNotCreate = 0;
    stats.skipNoText = 0;
    stats.skipNoTopic = 0;
    stats.skipNoLang = 0;
    stats.skipRateLimit = 0;
}

function tweet() {
    global.logger.log('info', 'tweet - startup.');
    var ws = new WebSocket('wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post');

    ws.on('open', function() {
        global.logger.log('info', 'bluesky stream opened (max ' + maxPerSec +
            ' posts/s, requireTopic=' + requireTopic + ', langs=' +
            (allowedLangs ? allowedLangs.join(',') : 'any') + ')');
    });

    ws.on('error', function(error) {
        global.logger.log('error', error);
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(tweet, 60000);
    });

    ws.on('close', function() {
        global.logger.log('warn', 'bluesky closed the stream');
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(tweet, 60000);
    });

    ws.on('message', function(data) {
        try {
            var msg = JSON.parse(data);
            var decision;
            stats.received += 1;
            decision = ingestDecision(msg);
            if (decision !== 'post') {
                recordSkip(decision);
                return;
            }
            var text = msg.commit.record.text;

            var mockTweet = {
                _ts: new Date().getTime(),
                text: text,
                user: {
                    screen_name: msg.did // did is user identifier in Bluesky
                },
                bluesky: true
            };
            if (msg.commit.record.langs) {
                mockTweet.langs = msg.commit.record.langs;
            }
            
            stats.posted += 1;
            doPost(mockTweet);

        } catch(err) {
            // Ignore parse errors
        }
    });
}

function main() {
    if (demoDisabled()) {
        global.logger.log('info', 'tweet - disabled (ENABLE_BLUESKY_DEMO=false).');
        return;
    }
    cleanup();
    setInterval(cleanup, 60000);
    setInterval(logIngestStats, 60000);
    tweet();
}

if (process.env.NODE_ENV !== 'test') {
    main();
}

Tweet.cleanup = cleanup;
Tweet.doPost = doPost;
Tweet.tweet = tweet;
Tweet.matchesTopic = matchesTopic;
Tweet.matchesLang = matchesLang;
Tweet.ingestDecision = ingestDecision;
Tweet.shouldIngest = shouldIngest;
Tweet.takeRateToken = takeRateToken;
Tweet.logIngestStats = logIngestStats;
Tweet.main = main;

module.exports = Tweet;
