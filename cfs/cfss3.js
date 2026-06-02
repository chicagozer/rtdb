// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0

// amazon S3 filesystem support
// remember to set your S3 parms in the settings.json
/*jslint node: true, white: true, nomen: true */
/*jshint laxbreak: true */

"use strict";
var { S3 } = require('@aws-sdk/client-s3');

function CFSS3() {
    return this;
}

/*jslint unparam: true */

CFSS3.prototype.exists = function (dir, callback) {
    callback(true);
};
/*jslint unparam: false */

CFSS3.prototype.init = function (parms) {
    parms.config = parms.config || {};
    parms.params = parms.params || {};

    if (process.env.AWS_SECRET) {
        parms.config.secretAccessKey = process.env.AWS_SECRET;
    }
    if (process.env.AWS_KEY) {
        parms.config.accessKeyId = process.env.AWS_KEY;
    }
    if (process.env.AWS_BUCKET) {
        parms.params.Bucket = process.env.AWS_BUCKET;
    }

    else {
        return false;
    }

    var credentials = {};
    if (parms.config.accessKeyId && parms.config.secretAccessKey) {
        credentials = {
            accessKeyId: parms.config.accessKeyId,
            secretAccessKey: parms.config.secretAccessKey
        };
    }

    this.s3 = new S3({
        ...parms.config,
        credentials: Object.keys(credentials).length > 0 ? credentials : undefined
    });
    this.defaultBucket = parms.params.Bucket;
    return true;

};

CFSS3.prototype.name = function () {
    return 'CFSS3';
};

CFSS3.prototype.get = function (key, callback) {

    this.s3.getObject({
        Bucket: this.defaultBucket,
        Key: key
    }, function (err, data) {
        if (err) {
            callback(err);
        } else {
            data.Body.transformToString().then(function (str) {
                callback(null, JSON.parse(str));
            }).catch(callback);
        }
    });
};

CFSS3.prototype.del = function (fn, callback) {
    var key = fn;
    this.s3.deleteObject({
        Bucket: this.defaultBucket,
        Key: key
    }, callback);
};

CFSS3.prototype.put = function (prefix, item, callback, expires) {
    var buf = Buffer.from(JSON.stringify(item)),
        key, expireDate = null;

    if (item._identity) {
        key = prefix + item._identity._id + '.json';
    } else if (item._id) {
        key = prefix + item._id + '.json';
    } else {
        callback(new Error('No _id found in item.'));
        return;
    }

    global.logger.log('debug', 'CFSS3.put - key:', key);

    if (expires) {
        expireDate = new Date(new Date().getTime() + expires);
        this.s3.putObject({
            Bucket: this.defaultBucket,
            Key: key,
            Body: buf,
            Expires: expireDate
        }, callback);
    } else {
        this.s3.putObject({
            Bucket: this.defaultBucket,
            Key: key,
            Body: buf
        }, callback);
    }
};

CFSS3.prototype.list = function (prefix, callback) {

    var self = this,
        keys = [];

    function fetchNext(prefix, nextMarker, callback) {

        var options = {
            Bucket: self.defaultBucket,
            Prefix: prefix
        };
        if (nextMarker) {
            options.Marker = nextMarker;
        }

        global.logger.log('debug', 'CFSS3.list - prefix:' + prefix + ' marker:' + nextMarker);
        self.s3.listObjects(options, function (err, files) {
            if (err) {
                callback(err);
                return;
            }
            files.Contents.forEach(function (item) {
                if (item.Size > 0 && item.Key.match('\\.json$')) {
                    keys.push(item.Key);
                }
            });
            if (files.IsTruncated) {
                fetchNext(prefix, keys.pop(), callback);
            } else {
                callback(null, keys);
            }

        });

    }
    global.logger.log('debug', 'CFSS3.list ', prefix);
    fetchNext(prefix, null, callback);

};

module.exports = CFSS3;
