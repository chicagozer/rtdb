// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
"use strict";
var http = require('http');

function postDocuments(collectionId, body, callback) {
    var payload = JSON.stringify(body),
        options = {
            host: process.env.OPENSHIFT_NODEJS_IP || 'localhost',
            port: process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || process.env.VCAP_APP_PORT || 9001,
            path: '/db/collections/' + collectionId + '/documents',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': Buffer.byteLength(payload)
            }
        },
        req;

    req = http.request(options, function (res) {
        res.on('data', function () {
            return undefined;
        });
        res.on('end', function () {
            if (callback) {
                callback(null, res.statusCode);
            }
        });
    });

    req.on('error', function (err) {
        if (callback) {
            callback(err);
        }
    });

    req.write(payload);
    req.end();
}

module.exports = {
    postDocuments: postDocuments
};
