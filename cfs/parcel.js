// © 2014 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0

// parcels.js supports the demo for Tax Parcels. Because it's in the cfs subfolder
// it gets loaded at runtime. It loads the database on a timer and flushes every 5 mins
// in a production environment, remove this file from the cfs folder.
/*jslint node: true, white: true, nomen: true */
"use strict";
var http = require('http');
var fs = require('fs');
var async = require('async');
var path = require('path');

function Parcel() {
    return this;
}

var dir = __dirname + path.sep + 'sampledb' + path.sep + parcels + path.sep;

var poptions = {
    host: process.env.OPENSHIFT_NODEJS_IP || 'localhost',
    port: process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 9001,
    path: '/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/documents',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
};

var foptions = {
    host: process.env.OPENSHIFT_NODEJS_IP || 'localhost',
    port: process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 9001,
    path: '/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/documents?permanent=false',
    method: 'DELETE',
    headers: {
        'Content-Type': 'application/json'
    }
};

// Setup the request. The options parameter is
// the object we defined above.
var count = 0;

function readFile(file, callback) {

    var start = new Date();

    fs.readFile(dir + file, 'utf-8', function(err, data) {
        if (err) {
            callback(err);
            return;
        }

        poptions.headers['Content-Length'] = data.length;

        var req = http.request(poptions, function(res) {

            res.setEncoding('utf-8');
            res.on('end', function() {
                var delay, now = new Date();
                // we are going to slow this down to a max of 100
                // inserts per sec
                delay = Math.max(0, 10 - (now - start));
                setTimeout(callback, delay);
            });

            /*jslint unparam: true */
            res.on('data', function(data) {
                return undefined;
            });
            /*jslint unparam: false */
            res.on('error', function(err) {
                callback(err);
            });

        });

        req.on('error', function(err) {
            callback(err);
        });

        if (global.logger.level === 'silly') {
            global.logger.log('silly', 'HStream.readFile - writing ' + count);
            count = count + 1;
        }
        req.write(data);
        req.end();

    });

}

function flush() {

    var req = http.request(foptions, function(res) {
        res.setEncoding('utf-8');
        /*jslint unparam: true */
        res.on('data', function(data) {
            return undefined;
        });
        res.on('error', function(err) {
            return undefined;
        });
        /*jslint unparam: false */
    });

    req.end('{}');

}

function main2() {
    fs.readdir(dir, function(err, files) {
        if (err) {
            throw err;
        }
        async.eachSeries(files, readFile, function(err) {
            if (err) {
                global.logger.log('error', 'parcel.readFile - ', err);
            } else {
                global.logger.log('debug', 'parcel.readFile - done');
            }
            setTimeout(main2, 0);
        });

    });
}

function main() {
    setInterval(flush, 1000 * 60 * 5);
    main2();
}
setTimeout(main, 10000);

module.exports = Parcel;
