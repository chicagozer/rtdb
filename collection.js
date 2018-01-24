// © 2014 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
/*jslint node: true, white: true, nomen: true */
/*jshint laxbreak: true */
"use strict";
var events = require('events');
var Identity = require('./identity');
var async = require('async');
var View = require('./view');

// this controls concurrency when dealing with files
var eachLimit = 10;

function Collection(database, obj) {

    if (null !== obj && "object" === typeof obj) {
        this._identity = obj;
        if (this._identity._onAdd) {
            /*jshint evil: true */
            /*jslint evil: true */
            this._fonAdd = new Function("item", "database",
                this._identity._onAdd);
            /*jslint evil: false */
            /*jshint evil: false */
        }
    } else {
        this._identity = new Identity();
    }

    this._emitter = new events.EventEmitter();

    this.database = database;
    this.views = new Map();

    this._workingdocs = [];
    this.stats = {
        fileCount: 0
    };

    var self = this,
        lastReduce = null,
        lastExpire = null;

    function dateDiff(date1, date2) {
        return date1.getTime() - date2.getTime();
    }

    function doExpire() {

        global.logger.log('debug', 'expiring ' + self._identity._id);
        // calculate when was the last expire. if less than 1 sec (now
        // configurable), hold off.
        var now = new Date(),
            delay = 0,
            interval, delta;

        if (lastExpire) {
            delta = dateDiff(now, lastExpire);

            interval = 1000 * 60;
            if (self.database.globalSettings.expireInterval) {
                interval = self.database.globalSettings.expireInterval;
            }

            delay = Math.max(0, interval - delta);
        }
        lastExpire = now;

        setTimeout(function() {
            self._workingdocs.length = 0;
            Array.from(self.views.values()).forEach(function(v) {
                v.reset();
            });
            self.loadDocuments(Array.from(self.views.values()), function(err) {
                if (err) {
                    global.logger.log('error', err);
                }
                self._emitter.once('expire', doExpire);
            });
        }, delay);
    }

    function doReduce() {

        global.logger.log('debug', 'in reduce! ', self._identity._id);
        // calculate when was the last reduce. if less than 1 sec (now
        // configurable), hold off.
        var now = new Date(),
            interval, delta, delay = 0;
        if (lastReduce) {
            delta = dateDiff(now, lastReduce);

            interval = 1000;
            if (self.database.globalSettings.reduceInterval) {
                interval = self.database.globalSettings.reduceInterval;
            }
            delay = Math.max(0, interval - delta);
        }

        lastReduce = now;
        global.logger.log('debug', 'reduce delay is ', delay);

        setTimeout(function() {
            global.logger.log('debug', 'Reducing ', self._identity._id);
            Array.from(self.views.values()).forEach(function(elem) {
                try {
                    elem.mapreduce(self._workingdocs, true);
                } catch (e) {
                    global.logger.log('error', 'reduce - ' + e.toString());
                }
            });
            self._workingdocs.length = 0;
            self._emitter.once('change', doReduce);
        }, delay);
    }

    // THIS is the secret sauce...we are registering our listener for reduce
    // requests!
    self._emitter.once('change', doReduce);
    self._emitter.once('expire', doExpire);

    return this;
}

Collection.prototype.init = function(key, trans, priority, expiration, onAdd) {
    if (!this._identity) {
        this._identity = new Identity();
    }
    this._identity._key = key;
    this._identity._transient = trans;
    this._identity._priority = priority;
    this._identity._expiration = expiration;

    if (onAdd) {
        this._identity._onAdd = onAdd;
        /*jshint evil: true */
        /*jslint evil: true */
        this._fonAdd = new Function("item", "database", onAdd);
        /*jslint evil: false */
        /*jshint evil: false */
    } else {
        if (this._identity._onAdd) {
            delete this._identity._onAdd;
        }
        if (this._fonAdd) {
            delete this._fonAdd;
        }
    }
    return this;
};

Collection.prototype.push = function() {

    var retval, docs, self = this;

    docs = Array.prototype.slice.call(arguments, 0);

    if (docs.length === 0) {
        return;
    }

    retval = docs;

    if (self._fonAdd) {
        // ok so we are going to implement a trigger
        docs.forEach(function(e) {
            self._fonAdd(e, self.database);
        });
    }

    if (!this._identity._transient && self._identity._expiration) {
        // if this collection has an expiration, set up a timer to expire the
        // docs
        setTimeout(function() {
            self._emitter.emit('expire');
        }, self._identity._expiration);
    }

    if (this.views.size > 0) {
        docs.forEach(function(item) {
            self._workingdocs.push(item);
        });
        // signal for reduce.
        global.logger.log('silly', 'emitting change for ', self._identity._id);

        self._emitter.emit('change');
    }
    return retval;

};

Collection.prototype.loadDocuments = function(viewlist, callback) {

    var self, dir = 'collection/' + this._identity._id + '/documents/';

    self = this;
    global.logger.log('debug',
        'Collection.loadDocuments: viewlist length:' + viewlist.length + ' loading documents from ', dir);
    self._workingdocs.length = 0;

    function readIt(item, callback) {
        self.database.cfs.get(item, function(err, data) {
            if (err) {
                global.logger.log('error', err);
                callback(err);
                return;
            }
            if (!self._identity._transient) {
                self._workingdocs.push(data);
            }

            callback();
        });
    }

    function innerLoop(idx, files, callback) {

        // do we have anything to reduce?
        if (idx >= files.length) {
            callback();
            return;
        }
        var subset, notify = idx + 100 >= files.length;
        global.logger.log('debug', 'Collection.loadDocuments.innerLoop idx:' + idx + ' doc count is ' + self._workingdocs.length);

        subset = files.slice(idx, idx + 100);

        // we need to use the async library to do 100 at a time.
        global.logger.log('debug',
            'Collection.loadDocuments.innerLoop calling asynceach');
        async.eachLimit(subset, eachLimit, readIt, function(err) {
            if (err) {
                callback(err);
                return;
            }

            global.logger.log('debug',
                'Collection.loadDocuments.innerLoop viewlist.length is ' + viewlist.length + ' workingdocs.length is ' + self._workingdocs.length + ' notify is ' + notify);
            if (self._workingdocs.length > 0) {
                viewlist.forEach(function(v) {
                    global.logger.log('debug',
                        'Collection.loadDocuments.innerLoop reducing :' + v.getId());
                    try {
                        if (v._identity._exception) {
                            delete v._identity._exception;
                        }
                        v.mapreduce(self._workingdocs, notify);
                    } catch (e) {
                        global.logger.log('error', e.toString());
                        v._identity._exception = e.toString();
                    }
                });
                // reset to zero
                self._workingdocs.length = 0;
            }

            innerLoop(idx + 100, files, callback);

        });
    }

    self.database.cfs.exists(dir, function(exists) {

        if (exists) {
            self.database.cfs.list(dir, function(err, files) {
                if (err) {
                    global.logger.log('error', 'Collection.loadDocuments [' + self._identity._id + ']', err);
                    callback(err);
                    return;
                }
                var count = files.length;
                self.stats.fileCount = count;
                global.logger.log('debug', 'Collection.loadDocuments: [' + self._identity._id + '] document count is ', count);

                innerLoop(0, files, callback);

            });
        } else {
            global.logger.log('warn', 'Collection.loadDocuments [' + self._identity._id + '] ' + dir + ' does not exist.');
            callback();
        }
    });
};

Collection.prototype.loadViews = function(callback) {

    var self, vdir, dir = 'collection/' + this._identity._id;
    self = this;
    vdir = dir + '/views/';

    global.logger.log('debug', 'Collection.loadViews', vdir);
    self.database.cfs
        .exists(
            vdir,
            function(exists) {
                if (exists) {
                    global.logger.log('debug',
                        'Collection.loadViews listing ', vdir);
                    self.database.cfs
                        .list(
                            vdir,
                            function(err, files) {
                                if (err) {
                                    global.logger
                                        .log(
                                            'error',
                                            'Collection.loadViews [' + self._identity._id + ']',
                                            err);
                                    callback();
                                    return;
                                }

                                var count = files.length;

                                if (count === 0) {
                                    callback();
                                    return;
                                }

                                async
                                    .eachLimit(
                                        files,
                                        eachLimit,
                                        function(item,
                                            callback) {
                                            global.logger
                                                .log(
                                                    'debug',
                                                    'Collection.loadViews: loading view [' + self._identity._id + ']',
                                                    item);
                                            self.database.cfs
                                                .get(
                                                    item,
                                                    function(
                                                        err,
                                                        data) {
                                                        if (err) {
                                                            global.logger
                                                                .log(
                                                                    'error',
                                                                    'Collection.loadViews [' + self._identity._id + ']',
                                                                    err);
                                                            callback(err);
                                                            return;
                                                        }

                                                        global.logger
                                                            .log(
                                                                'debug',
                                                                'Collection.loadViews - [' + self._identity._id + '] creating view from ',
                                                                data);
                                                        var v = new View(
                                                            self.database,
                                                            self,
                                                            data);

                                                        self.views.set(v.getId(), v);
                                                        if (self._identity._transient) {
                                                            global.logger.log(
                                                                'debug',
                                                                'Collection.loadViews - [' + self._identity._id + '] loading reduction ',
                                                                v
                                                                .getId());
                                                            global.logger.log(
                                                                'debug',
                                                                'Collection.loadViews - [' + self._identity._id + '] loading reduction from  ' + dir + '/view/');
                                                            v.loadReduction(
                                                                dir + '/view/',
                                                                function(
                                                                    err) {
                                                                    if (err) {
                                                                        global.logger
                                                                            .log(
                                                                                'error',
                                                                                'Collection.loadViews [' + self._identity._id + ']',
                                                                                err);
                                                                        callback(err);
                                                                        return;
                                                                    }
                                                                });
                                                        }
                                                        callback();

                                                    });
                                        }, callback);

                            });
                } else {
                    global.logger.log('warn', 'Collection.loadViews [' + self._identity._id + '] ' + vdir + ' does not exist.');
                    callback();
                }
            });
};

Collection.prototype.addView = function(v, callback) {
    var self = this;

    self.loadDocuments([v], function(err) {
        if (err) {
            callback(err);
            return;
        }
        global.logger.log('debug', 'Collection.addView before count:' + self.views.size);
        self.setViewAt(v.getId(), v);
        self.database.addView(v);
        global.logger.log('debug', 'Collection.addView after count:' + self.views.size);

        var dn = 'collection/' + self.getId() + '/views/';
        self.database.cfs.put(dn, v.getIdentity(), callback);
    });
};

Collection.prototype.updateView = function(v, callback) {
    var self = this;

    self.loadDocuments([v], function(err) {
        if (err) {
            callback(err);
            return;
        }

        if (v._identity._exception) {
            callback(v._identity._exception);
            return;
        }

        var dn = 'collection/' + self.getId() + '/views/';
        self.database.cfs.put(dn, v.getIdentity(), callback);
    });
};

Collection.prototype.removeView = function(vid, callback) {
    var msg, dir, dn, fn, v = this.views.get(vid);
    if (v) {
        this.views.delete(vid);

        this.database.removeView(vid);

        dir = 'collection/' + this._identity._id;
        dn = dir + '/views/';

        // nuke the view file
        fn = dn + vid + '.json';

        this.database.cfs.del(fn, callback);
        // should we put it back in, if the delete fails??
    } else {
        msg = 'Collection.removeView - View ' + vid + ' not found.';
        global.logger.log('warn', msg);
        callback(new Error(msg));
    }
};

function removeFiles(c, deleteFiles, callback) {
    if (c._identity._transient || !deleteFiles) {
        callback();
        return;
    }
    var dn = 'collection/' + c.getId() + '/documents/';
    // grab all the collections from the file system
    c.database.cfs.list(dn, function(err, files) {
        if (err) {
            global.logger.log('error', 'Collection.removeFiles ', err);
            callback(err);
            return;
        }
        async.eachLimit(files, eachLimit, function(item, callback2) {
            c.database.cfs.del(item, callback2);
        }, callback);
    });
}

Collection.prototype.clear = function(deleteFiles, notify, callback) {

    var self = this;
    self._workingdocs = [];
    self.stats.fileCount = 0;

    removeFiles(self, deleteFiles, function(err) {
        if (err) {
            callback(err);
            return;
        }
        Array.from(self.views.values()).forEach(function(v) {
            v.reset();
            if (notify) {
                v._emitter.emit('change');
            }
        });

        callback();
    });
};

Collection.prototype.put = function(body, callback) {

    if (body.length === 0) {
        callback();
        return;
    }

    var dn, self = this;
    self.stats.fileCount += body.length;

    body.forEach(function(item) {
        if (!item._identity) {
            item._identity = new Identity();
        }
    });

    dn = 'collection/' + self._identity._id + '/documents/';

    // write first
    // DOIT, implement some sort of rollback
    // in the event of a write failure
    function write(item, callback) {
        self.database.cfs.put(dn, item, callback);
    }

    if (!self._identity._transient) {
        async.eachLimit(body, eachLimit, write, function(err) {
            if (err) {
                callback(err);
            } else {
                self.push.apply(self, body);
                callback();
            }
        });
    } else {
        self.push.apply(self, body);
        callback();
    }
};

Collection.prototype.setViewAt = function(idx, val) {
    this.views.set(idx, val);
};

Collection.prototype.viewAt = function(idx) {
    return this.views.get(idx);
};

Collection.prototype.toString = function() {
    return this._identity;
};

Collection.prototype.getIdentity = function() {
    return this._identity;
};

Collection.prototype.getId = function() {
    return this._identity._id;
};

Collection.prototype.getStats = function() {
    var val = { stats: this.stats, views: {}};
    val.stats.totalReduceTime = 0;
    this.views.forEach(function(value, key) {
        val.views[key] = value.stats;
        val.stats.totalReduceTime += value.stats.totalReduceTime;
    });

   return val;
}

Collection.prototype.isTransient = function() {
    return this._identity._transient;
};

module.exports = Collection;
