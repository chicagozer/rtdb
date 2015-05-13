// © 2014 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
/*jslint node: true, white: true, nomen: true */
"use strict";
var events = require('events');
var Identity = require('./identity');
var vm = require('vm');
var _ = require("underscore");
var Symmetry = require('symmetry');
var crypto = require('crypto');
// constructor

// arguments: reference to database and optional json from filesystem
//
//
function View(database, collection, obj) {

    // if we are loading from filesystem
    if (null !== obj && "object" === typeof obj) {
        this._identity = obj;
        this._fmapScript = vm.createScript(this._identity._map);
        this._freduceScript = vm.createScript(this._identity._reduce);

        /*jshint evil: true */
        /*jslint evil: true */
        this._fmap = new Function("item", "emit", "database",
            this._identity._map);
        this._freduce = new Function("values", "rereduce", "emit", "database",
            this._identity._reduce);

        // if there a finalize method, initialize it
        if (this._identity._finalize) {
            this._ffinalize = new Function("reduction", "emit", "database",
                this._identity._finalize);
            this._ffinalizeScript = vm.createScript(this._identity._finalize);
        }

        if (this._identity._personalize) {
            this._fpersonalize = new Function("reduction", "headers", "emit",
                "database", this._identity._personalize);
            this._fpersonalizeScript = vm
                .createScript(this._identity._personalize);
        }
        /*jslint evil: false */
        /*jshint evil: false */

    } else {
        // otherwise we are new, make an identity
        this._identity = new Identity();
    }

    // initialize an emitter
    this._emitter = new events.EventEmitter();

    // we have no subscriptions right now
    this.subscriptions = {};
    this.tickets = {};

    // reset all the _privates
    this.reset();

    // save the database
    this.database = database;
    this.collection = collection;

    // make a reference for our closures
    var self = this;

    // on change function to notify subscriptions
    this._emitter.on('change', function() {

        global.logger.log('debug', 'View.onChange - ', self._identity._id);

        // for each element in our subscription list
        Object.keys(self.subscriptions).forEach(
            function(key) {
                // grab the result handle
                var data, myReduction, res, socket, sub;

                sub = self.subscriptions[key];
                res = sub.res;
                socket = sub.socket;

                myReduction = self.personalize(key);
                // write the reduction

                // NOTE we need to break this up or express escape encodes
                // it. must think it's a header!

                if (sub.overflow) {
                    sub.data = myReduction;
                } else {

                    if (sub._identity.delta) {
                        data = Symmetry.diff(sub.last, myReduction);

                    } else {
                        data = myReduction;
                    }

                    sub.last = myReduction;

                    if (res) {
                        res.write("event: ");
                        res.write(self._identity._id);
                        res.write("\ndata: ");
                        if (!res.write(JSON.stringify(data) + "\n\n")) {
                            global.logger.log('warn',
                                'View.onChange - buffer full:', key);
                            sub.overflow = true;
                        }
                    }
                    if (socket) {
                        socket.volatile.emit(self._identity._id, data);
                    }
                }

            });
    });
}

View.prototype.personalize = function(key) {
    var personalizeEmit, sub, myReduction, self = this;

    sub = self.subscriptions[key];

    myReduction = self.reduction;
    // lets personalize it
    if (self._identity._personalize) {
        personalizeEmit = function(result) {
            myReduction = result;
        };

        self._fpersonalize(myReduction, sub._identity.headers, personalizeEmit,
            self.database);
    }
    return myReduction;
};

// reduction@ does a lookup via hash instead of index
View.prototype.reductionAt = function(idx) {
    return this.reduction[this._reductionHash[idx]];
};

// initialize from starting values.
View.prototype.init = function(key, map, reduce, finalize, personalize) {
    if (!this._identity) {
        this._identity = new Identity();
    }

    this._identity._key = key;

    this._identity._map = map;
    /*jshint evil: true */
    /*jslint evil: true */
    this._fmap = new Function("item", "emit", "database", map);
    this._fmapScript = vm.createScript(map);
    this._identity._reduce = reduce;
    this._freduce = new Function("values", "rereduce", "emit", "database",
        reduce);
    this._freduceScript = vm.createScript(reduce);

    this.reset();
    // save functions
    // LATER decide whether to use Functions or Scripts

    // if we are finalizing, take care of that too
    if (finalize) {
        this._ffinalize = new Function("reduction", "emit", "database",
            finalize);
        this._ffinalizeScript = vm.createScript(finalize);
        this._identity._finalize = finalize;
    }

    // if we are finalizing, take care of that too
    if (personalize) {
        this._fpersonalize = new Function("reduction", "headers", "emit",
            "database", personalize);
        this._fpersonalizeScript = vm.createScript(personalize);
        this._identity._personalize = personalize;
    }
    /*jslint evil: false */
    /*jshint evil: false */
    return this;
};

// mapreduce is the main function
// take in the array to mapreduce
// this method is additive - we add the results to what we have

View.prototype.mapreduce = function(documents, notify) {
    // save a reference for our closures
    var hrDiff, key, finalizeEmit, mapEmit, clone, mapResult, hrStart, self = this;

    hrStart = process.hrtime();

    // local map result
    mapResult = {};
    global.logger.log('debug', 'View.mapreduce - started for ' + self._identity._id);

    // make a copy of our current reduction.
    // we will compare it at the end to decide if notifications are
    // necessary
    // LATER  what's most efficient??
    // var clone = _.clone(self.reduction);
    clone = JSON.parse(JSON.stringify(self.reduction));

    // heres the map emit function - save each emitted value in mapResult
    // according
    // to the key
    mapEmit = function(key, value) {
        if (!mapResult[key]) {
            mapResult[key] = [];
        }
        mapResult[key].push(value);
    };

    // do the map function
    documents.forEach(function(e) {
        self._fmap(e, mapEmit, self.database);
        global.logger
            .log('silly', 'View.mapreduce - item is ', e._identity._id);
        // self._fmapScript.runInNewContext({ item : e, emit : mapEmit, database
        // : self.database, logger : logger});
    });

    // this is the reduce function by key
    function innerReduce(key) {

        // call the reduce method
        self._freduce(mapResult[key], false, function(results) {

            // if we don't have a result, then
            // add it to our hashes or push it
            if (!(self._reduceResultHash.hasOwnProperty(key))) {
                self._reduceResultHash[key] = self._reduceResult.length;
                self._reduceResult.push([results]);
            } else {
                self._reduceResult[self._reduceResultHash[key]].push(results);
            }

        }, self.database);
    }

    // do our reduce for each key
    for (key in mapResult) {
        if (mapResult.hasOwnProperty(key)) {
            innerReduce(key);
        }
    }

    // now we are going to "re-reduce". This part combines the keys that have >1
    // element.
    // this is the essence of how the algorithm works - thanks couchdb!
    // console.log('before..._reduceResultHash');
    // console.dir(self._reduceResultHash);
    // console.log('_reduceResult');
    // console.dir(self._reduceResult);
    // console.log('_redcontainer.reduction');
    // console.dir(self._redcontainer.reduction);

    function innerReReduce(key2) {
        // only need to mess with hashes that have > 1 element
        if (self._reduceResult[self._reduceResultHash[key2]].length > 1) {
            self
                ._freduce(
                    self._reduceResult[self._reduceResultHash[key2]],
                    true,
                    function(results) {
                        // we are expecting a single value. so update
                        // our hashes
                        self._reduceResult[self._reduceResultHash[key2]].length = 0;
                        self._reduceResult[self._reduceResultHash[key2]]
                            .push(results);

                    }, self.database);
            // self._reduceScript.runInNewContext({ values :
            // this.reduceResult[key], rereduce : true, emit : r2Emit, database
            // : self.database, logger : logger});
        }

    }

    self._redcontainer.reduction = [];
    // run through and do a re-reduce
    for (key in self._reduceResultHash) {

        if (self._reduceResultHash.hasOwnProperty(key)) {
            innerReReduce(key);
            // FIXME do we really need to rebuild this??
            self._redcontainer.reduction.push([key,
                self._reduceResult[self._reduceResultHash[key]][0]
            ]);
        }
    }

    // console.log('after..._reduceResultHash');
    // console.dir(self._reduceResultHash);
    // console.log('_reduceResult');
    // console.dir(self._reduceResult);
    // console.log('_redcontainer.reduction');
    // console.dir(self._redcontainer.reduction);

    // finalize function is easy - we just spit out what gets emitted to us
    // finalize is good for sorting/top x/averages/etc
    finalizeEmit = function(result) {
        self.reduction = result;
    };

    // if there is a finalize, do it - otherwise return current reduction
    if (self._identity._finalize) {
        // FIXME maybe clone it here?
        // the problem is that when I go chopping the reduction it messes up the
        // indexing on self._redcontainer.reduction
        self._ffinalize(self._redcontainer.reduction, finalizeEmit,
            self.database);
    } else {
        self.reduction = self._redcontainer.reduction;
    }

    // rebuild the hash index
    self._reductionhash = {};
    self.reduction.forEach(function(r, idx) {
        self._reductionHash[r[0]] = idx;
    });

    // self._finalizeScript.runInNewContext({ reduction :
    // this.redcontainer.reduction, emit : finalizeEmit, database :
    // self.database, logger : logger});

    global.logger.log('debug', 'View.mapreduce - ended for ' + self._identity._id);

    hrDiff = process.hrtime(hrStart);
    self.stats.reduceCount = self.stats.reduceCount + 1;
    self.stats.totalReduceTime += (hrDiff[0] + (hrDiff[1] / 1e9));

    // if the reduction changed, emit!
    if (notify && !_.isEqual(clone, self.reduction)) {
        self._emitter.emit('change');
    }
};

// write reduction to disk
View.prototype.saveReduction = function(dir, callback) {
    // generate a filename
    var fn = dir + this._identity._id + '/reduction/';
    // save it
    this.database.cfs.put(fn, this._redcontainer, callback);
};

// clear out all the _privates and the reduction
View.prototype.reset = function() {
    this._reduceResult = [];
    this._reduceResultHash = {};
    this._reductionHash = {};
    this.reduction = [];
    this._redcontainer = {};
    this.stats = {
        reduceCount: 0,
        totalReduceTime: 0.0
    };
    // reduction container will be used to save the reduction to filesystem
    this._redcontainer._identity = new Identity();

    this._redcontainer.reduction = [];

};
// load the reduction from Disk
View.prototype.loadReduction = function(dir, callback) {

    var rn, self = this;
    rn = dir + this._identity._id + '/reduction/';

    // see what is in the reduction folder
    this.database.cfs.list(rn, function(err, files) {
        if (err) {
            callback(err);
            return;
        }
        // if there is a single reduction file, grab it
        if (files.length === 1) {
            self.database.cfs.get(files[0], function(err, data) {
                if (err) {
                    global.logger.log('warn', 'View.loadReduction - ' + rn + 'not loaded.', err);
                    // callback(err);
                    return;
                }
                global.logger.log('debug',
                    'View.loadReduction - reduction is ', data);

                // we can marshal the json right into _redcontainer
                self._redcontainer = data;

                // setup our hashes
                self._redcontainer.reduction
                    .forEach(function(key, idx) {

                        self._reduceResultHash[key[0]] = idx;
                        self._reduceResult.push([key[1]]);
                        self._reductionHash[key[0]] = idx;
                        self.reduction.push(key);
                    });

                callback();

            });

        } else {
            // we didn't find a single file.
            global.logger.log('warn', 'Not expecting ' + files.length + ' reductions in ' + rn);
            callback();
        }

    });
};

View.prototype.getIdentity = function() {
    return this._identity;
};

View.prototype.toString = function() {
    return this._identity;
};

View.prototype.getId = function() {
    return this._identity._id;
};

// reduction@ does a lookup via hash instead of index
View.prototype.issueTicket = function() {
    //LATER MAYBE ASYNC?
    var ticket = crypto.randomBytes(32).toString('hex');
    this.tickets[ticket] = new Date();
    return ticket;
};

// reduction@ does a lookup via hash instead of index
View.prototype.checkTicket = function(ticket) {
    // LATER we need something more secure

    var key, now, reply = false;
    now = new Date();
    for (key in this.tickets) {
        if (this.tickets.hasOwnProperty(key)) {
            if (ticket === key && now - this.tickets[key] < 60000) {
                reply = true;
            }
            if (now - this.tickets[key] >= 60000) {
                delete this.tickets[key];
            }
        }
    }
    return reply;
};

// do the exports thing
module.exports = View;