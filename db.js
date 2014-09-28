// © 2014 by Rheosoft. All rights reserved. 
// Licensed under the RTDB Software License version 1.0
/*jslint node: true, white: true, nomen: true */
/*jshint laxbreak: true */
"use strict";
var events = require('events');
var fs = require('fs.extra');
var pjson = require('./package.json');
var async = require('async');
var argv = require('optimist').argv;

var Identity = require('./identity');
var Collection = require('./collection');
var View = require('./view');
var uuid = require('node-uuid');

function Database(settings, callback) {

    // save a reference for our closures
    var self = this,
        cfslist, cfsTypes = {};

    this.globalSettings = settings;

    // right now we support two configurable file systems
    // CFSL = local, CFSS3 = Amazon S3
    // it's pretty trival to make a new one - just look at the methods

    /*jslint stupid: true */
    cfslist = fs.readdirSync('./cfs');
    /*jslint stupid: false */

    cfslist.forEach(function (file) {
        var cfs = require('./cfs/' + file);
        cfsTypes[cfs.name] = cfs;
    });

    // load our collections
    function loadCollections(callback) {
        var dn = 'collections/';

        // load our documents
        function loadViewsAndDocuments(c, callback) {

            c
                .loadViews(function (err) {
                    if (err) {
                        global.logger.log('error',
                            'Database.loadViewsAndDocuments -  ', err);
                        callback(err);
                        return;
                    }
                    c.views.forEach(function (v) {
                        self._viewsHash[v.getId()] = v;
                    });

                    global.logger
                        .log(
                            'debug',
                            'Database.loadViewsAndDocuments: Loaded views ',
                            c.getId());

                    c
                        .loadDocuments(
                            c.views,
                            function (err) {
                                if (err) {
                                    global.logger
                                        .log(
                                            'error',
                                            'Database.loadViewsAndDocuments - loadDocuments ',
                                            err);
                                    callback(err);
                                    return;
                                }
                                global.logger
                                    .log(
                                        'debug',
                                        'Database.loadViewsAndDocuments: Documents completed ',
                                        c.getId());
                                callback();

                            });

                });
        }

        // we are going to call this function when we are done loading
        // and do some final initialization
        function doneLoading(err) {
            if (err) {
                global.logger.log('error', 'Database.loadCollections', err);
                callback(err);
                return;
            }

            // sort by priority. The priority is used when there are lookups
            // happening
            // in the views. If you need a collection in your view, the priority
            // ensures it gets loaded beforehand

            self.collections.sort(function (a, b) {
                return a._identity._priority ? a._identity._priority - b._identity._priority : 1;
            });

            // lets initialize the hash while we are here
            self.collections.forEach(function (c) {
                self._collectionsHash[c.getId()] = c;
            });

            if (global.logger.level === 'debug') {
                global.logger.log('debug',
                    'Database.loadCollections - now views then docs');
            }
            // now load documents and views
            // do this in sequential order
            async
                .eachSeries(
                    self.collections,
                    loadViewsAndDocuments,
                    function (err) {
                        if (err) {
                            global.logger.log('error',
                                'Database.loadCollections', err);
                            callback(err);
                            return;
                        }
                        global.logger
                            .log('debug',
                                'Database.loadCollections - now done with docs and views!!');
                        callback();
                    });
        }

        // grab all the collections from the file system
        self.cfs.list(dn, function (err, files) {
            if (err) {
                global.logger.log('error',
                    'Database.loadCollections - listObjects ', err);
                callback(err);
                return;
            }
            global.logger.log('debug', 'Database.loadCollections ' + JSON.stringify(files));

            // ok, for each one we are going to load it
            // when we are done with all of them, do
            // "doneLoading"
            async.each(files, function (item, callback) {
                global.logger.log('debug',
                    'Database.loadCollections - fetching ' + item);
                self.cfs.get(item, function (err, data) {
                    if (err) {
                        global.logger.log('error',
                            'Database.loadCollections - getObject ', err);
                        callback(err);
                        return;
                    }
                    global.logger.debug('debug',
                        'Database.loadCollections - creating Collection:',
                        data);
                    var c = new Collection(self, data);

                    // store
                    // it
                    // in
                    // our
                    // hashes
                    self._collectionsHash[c.getId()] = c;
                    self.collections.push(c);
                    callback();

                });
            }, doneLoading);

        });
    }

    // initialize some parms
    // we use pjson for the version
    this._identity = new Identity();

    this._identity._pjson = pjson;
    this._identity.copyright = '© 2014 by Rheosoft. All rights reserved.';

    // save some process information for our info page
    this._identity.process = {
        argv: process.argv,
        execPath: process.execPath,
        env: process.env,
        versions: process.versions,
        config: process.config,
        arch: process.arch,
        platform: process.platform
    };

    // this can't be private because the prototype needs it.
    this.collections = [];
    this._collectionsHash = {};
    this._viewsHash = {};
    this.tokens = {};

    // CFS is our configurable file system
    // based on the type in the settings file, initialize it
    self.cfs = new cfsTypes[self.globalSettings.cfs]();
    self.cfs.init(self.globalSettings.cfsinit);

    global.logger.log('info', 'cfs is ' + self.globalSettings.cfs + '.');
    global.logger.log('info', 'see settings file for connection parms.');

    // some signal handlers to allow us to save reductions on shutdown
    function loadSignalHandlers() {

        process.on('uncaughtException', function (exception) {
            global.logger.log('error', exception.toString());
        });

        process.on('SIGINT', function () {
            global.logger.log('info', 'Received sigint. Relaying to exit');
            self.saveViewsThenExit();
        });

        process.on('SIGTERM', function () {
            global.logger.log('info', 'Received sigterm. Relaying to exit');
            self.saveViewsThenExit();
        });

        process.on('exit', function () {
            global.logger.log('info', 'rtdb (' + self._identity._pjson.version + ') is exiting.');
        });
    }

    // ok - we are ready to load our collections
    loadCollections(function (err) {
        if (err) {
            global.logger.error('Database.loadCollections ', err);
            callback(err);
            return;
        }
        loadSignalHandlers();
        // finally we are done!!!
        callback();

    });
}

// shutdown function.
Database.prototype.saveViewsThenExit = function () {
    var self = this;

    if (global.logger.level === 'debug') {
        global.logger.log('debug', 'Database.saveViewsThenExit - started');
    }
    async.each(self.collections, function (c, callback) {
            global.logger.debug('Database.saveViewsThenExit - collection ', c
                .getId());
            // transient or not, save a copy of the views
            // I think we are going to reverse that decision

            if (!c.isTransient()) {
                async.each(c.views, function (v, callback) {
                    global.logger.debug('Database.saveViewsThenExit - view ', v
                        .getId());
                    var vd = 'collection/' + c.getId() + '/view/';
                    global.logger.log('debug',
                        'Database.onExit - writing view reduction to ' + vd);
                    v.saveReduction(vd, callback);
                }, function (err) {
                    callback(err);
                });
            } else {
                callback();
            }
        },
        function (err) {
            if (err) {
                global.logger.log('error', 'Database.saveViewsThenExit - ',
                    err);
            }
            global.logger.log('debug',
                'Database.saveViewsThenExit - calling exit');
            process.exit();
        });
};

Database.prototype.addView = function (v) {
    this._viewsHash[v.getId()] = v;
};

Database.prototype.removeView = function (vid) {
    delete this._viewsHash[vid];
};

Database.prototype.getToken = function (viewid) {
    if (!this.tokens[viewid]) {
        this.tokens[viewid] = uuid.v4();
    }

    return this.tokens[viewid];
};

Database.prototype.addCollection = function (c, callback) {
    this.collections.push(c);
    this.setCollectionAt(c.getId(), c);
    var dn = 'collections/';
    this.cfs.put(dn, c._identity, callback);
};

Database.prototype.updateCollection = function (c, callback) {
    var dn = 'collections/';
    this.cfs.put(dn, c.getIdentity(), callback);
};

Database.prototype.removeCollection = function (cid, callback) {
    var dn, idx, c, fn;

    c = this.collectionAt(cid);
    if (!c) {
        callback('not found');
        return;
    }
    idx = this.collections.indexOf(c);
    if (idx === -1) {
        callback('not found.');
        return;
    }
    dn = 'collections/';
    this.collections.splice(idx, 1);
    delete this._collectionsHash[cid];
    fn = dn + cid + '.json';
    this.cfs.del(fn, callback);
};

Database.prototype.getSettings = function () {
    return this.globalSettings;
};

Database.prototype.getIdentity = function () {
    return this._identity;
};
// return collection based on hash
Database.prototype.collectionAt = function (idx) {
    return this._collectionsHash[idx];
};

Database.prototype.setCollectionAt = function (idx, c) {
    this._collectionsHash[idx] = c;
};

// return collection based on hash
Database.prototype.viewAt = function (idx) {
    return this._viewsHash[idx];
};
module.exports = Database;