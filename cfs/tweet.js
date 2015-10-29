/*jslint unparam: true, node: true, white: true, nomen: true */
/*jshint laxbreak: true */

"use strict";
var util = require('util'),
    Twitter = require('twitter'),
    fs = require('fs'),
    path = require('path');
var twit = new Twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token_key: process.env.TWITTER_TOKEN_KEY,
    access_token_secret: process.env.TWITTER_TOKEN_SECRET
});


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
                endTime = new Date(stat.ctime).getTime() + 300000;
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
var match = 'insight2015,rtdb';
var arrayMatch = match.split(',');
var timeout;

function tweet() {
    global.logger.log('info', 'tweet - startup.');
    twit.stream('statuses/filter', {
        language: 'en',
        track: match
    }, function(stream) {
        stream.on('error', function(error) {
            global.logger.log('error', error);
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(tweet, 60000);
        });
        stream.on('end', function(error) {
            global.logger.log('warn', 'twitter closed the stream');
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(tweet, 60000);
        });
        stream.on('data', function(data) {
            if (!data.text) {
                return;
            }
            if (!arrayMatch.some(function(v) {
                    return data.text.indexOf(v) >= 0;
                })) {
                return;
            }

            if (data.retweeted_status) {
                data.retweeted_status._ts = new Date().getTime();
                doPost(data.retweeted_status);
            }

        });
    });
}

cleanup();
setInterval(cleanup, 60000);
tweet();

module.exports = Tweet;
