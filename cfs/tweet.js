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


//var match = 'php,nosql,jquery,nodejs,paas,clouddb,heroku,javascript,HTML5,hadoop,mongodb,json,websockets,jenkins,ruby,chef,puppet,ubuntu,centos,linux,oracle,mysql,salesforce,datatorrent';
var match = 'wanda,wandavision,insight2015,rtdb,nodejs,websockets,bluemix,watson,iot'
var arrayMatch = match.split(',');
var timeout;

function tweet() {
    global.logger.log('info', 'tweet - startup.');
    var ws = new WebSocket('wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post');

    ws.on('open', function() {
        global.logger.log('info', 'bluesky stream opened');
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
            if (!msg.commit || !msg.commit.record || !msg.commit.record.text) {
                return;
            }
            var text = msg.commit.record.text;
            
            if (!arrayMatch.some(function(v) {
                    return text.toLowerCase().indexOf(v.toLowerCase()) >= 0;
                })) {
                return;
            }

            var mockTweet = {
                _ts: new Date().getTime(),
                text: text,
                user: {
                    screen_name: msg.did // did is user identifier in Bluesky
                },
                bluesky: true
            };
            
            doPost(mockTweet);

        } catch(err) {
            // Ignore parse errors
        }
    });
}

if (process.env.NODE_ENV !== 'test') {
    cleanup();
    setInterval(cleanup, 60000);
    tweet();
}

Tweet.cleanup = cleanup;
Tweet.doPost = doPost;
Tweet.tweet = tweet;

module.exports = Tweet;
