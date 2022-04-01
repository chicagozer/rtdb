// © 2014 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
/*jslint node: true, white: true, nomen: true */
/*jshint laxbreak: true */
/*global describe, it, before, after*/
"use strict";
var assert = require('assert');
var argv = require('optimist').argv;
var fs = require('fs.extra');
var Database = require('../db');
var Collection = require('../collection');
var View = require('../view');
var winston = require('winston');
var Tempdir = require('temporary/lib/dir');
var async = require('async');

describe(
    'Suite',
    function() {
        var db = null,
            c = null,
            c2 = null,
            v = null,
            v2 = null,
            globalSettings = null,
            dir = null,
            cid = null,
            vid = null,
            vid2 = null;
        before(function() {

            /*jslint stupid: true */
            if (argv.settings) {
                globalSettings = JSON.parse(fs.readFileSync(argv.settings));
            } else if (process.env.MOCHA_SETTINGS) {
                globalSettings = JSON.parse(fs
                    .readFileSync(process.env.MOCHA_SETTINGS));
            } else {
                globalSettings = JSON.parse(fs
                    .readFileSync('settings/mocha.json'));
            }
            /*jslint stupid: false */
            // global on purpose
            // we are going to put this in global.
            global.logger = winston.createLogger(
                globalSettings.winston.options);

            globalSettings.winston.transports.forEach(function(item) {
                //global.logger.add(winston.transports[item[0]], item[1]);
                global.logger.add(new winston.transports[item[0]](item[1]) );
            });

            dir = new Tempdir();
            globalSettings.cfsinit.root = dir.path + '/';
            globalSettings.cfs = 'CFSL';

        });

        after(function() {
            /*jslint stupid: true */
            fs.rmrfSync(dir.path);
            /*jslint stupid: false */
        });

        describe(
            'Database',
            function() {

                it('Create a DB', function(done) {
                    db = new Database(globalSettings, done);
                });

                it('Create a Collection', function(done) {
                    c2 = new Collection(db).init('key', false, 1, 10, '{}');
                    db.addCollection(c2, done);
                });

                it('Create a Collection2', function(done) {
                    c = new Collection(db).init('collection', false, 1, false, '{}');
                    db.addCollection(c, done);
                });

                it('empty document', function(done) {
                    c.put("", done);
                });

                it('Create a document', function(done) {
                    var doc = [{
                        name: 'test',
                        value: 12
                    }, {
                        name: 'test',
                        value: 12
                    }, {
                        name: 'test2',
                        value: 13
                    }];
                    c.put(doc, function(err) {
                        assert(!err);
                        c2.put(doc, done);
                    });
                });

                it(
                    'Create a view',
                    function(done) {
                        v = new View(db, c)
                            .init(
                                'junk',
                                'emit(item.name,item.value)',
                                'emit(values.reduce(function (a, b) { return a + b;}));',
                                'reduction.sort(function(a,b){return b[1] -a[1];});emit(reduction);',
                                'emit(reduction);');
                        c.addView(v, done);
                    });
                it('check view', function() {
                  assert(c.views.size === 1);
                 });

                it('check reduction', function() {
                    var reduction = Array.from(v.reduction.entries());
                    assert(reduction[0][0] === 'test');
                    assert(reduction[0][1] === 24);
                    assert(reduction[1][0] === 'test2');
                    assert(reduction[1][1] === 13);

                });

                it('add document', function(done) {
                    var doc = [{
                        name: 'test3',
                        value: 10
                    }, {
                        name: 'test2',
                        value: 15
                    }];
                    c.put(doc, done);
                });

                it('check reduction', function(done) {
                    setTimeout(function() {
                        //console.dir(v.reduction);
			var reduction = Array.from(v.reduction.entries());
                        assert(reduction[0][0] === 'test2');
                        assert(reduction[0][1] === 28);
                        assert(reduction[1][0] === 'test');
                        assert(reduction[1][1] === 24);
                        assert(reduction[2][0] === 'test3');
                        assert(reduction[2][1] === 10);
                        done();
                    }, 1000);
                });

                it('add document', function(done) {
                    var doc = [{
                        name: 'test3',
                        value: 10
                    }, {
                        name: 'test2',
                        value: 10
                    }];
                    c.put(doc, done);
                });

                it('check reduction', function(done) {
                    setTimeout(function() {
			var reduction = Array.from(v.reduction.entries());
                        assert(reduction[0][0] === 'test2');
                        assert(reduction[0][1] === 38);
                        assert(reduction[1][0] === 'test');
                        assert(reduction[1][1] === 24);
                        assert(reduction[2][0] === 'test3');
                        assert(reduction[2][1] === 20);
                        done();
                    }, 100);
                });

                it('add 200 documents', function(done) {

                    var i = 0;
                    async.whilst(function(cb) {
                        cb(null, i <200);
                    }, function(callback) {
                        i++;
                        var doc = [{
                            name: 'test3',
                            value: 1
                        }, {
                            name: 'test2',
                            value: 1
                        }, {
                            name: 'test',
                            value: 1
                        }];

                        c.put(doc, callback);
                    }, done);
                });

                it('check reduction again ', function(done) {
                    setTimeout(function() {
			var reduction = Array.from(v.reduction.entries());
                        assert(reduction[0][0] === 'test2');
                        assert(reduction[0][1] === 238);
                        assert(reduction[1][0] === 'test');
                        assert(reduction[1][1] === 224);
                        assert(reduction[2][0] === 'test3');
                        assert(reduction[2][1] === 220);
                        done();
                    }, 1000);
                });

                it(
                    'Create a second view',
                    function(done) {
                        v2 = new View(db, c)
                            .init(
                                'junk2',
                                'emit(item.name,item.value)',
                                'emit(values.reduce(function (a, b) { return a + b;}));',
                                'reduction.sort(function(a,b){return b[1] -a[1];});emit(reduction);');
                        c.addView(v2, done);
                    });

                it('check reduction v2', function(done) {
                    setTimeout(function() {
			var reduction = Array.from(v2.reduction.entries());
                        assert(reduction[0][0] === 'test2');
                        assert(reduction[0][1] === 238);
                        assert(reduction[1][0] === 'test');
                        assert(reduction[1][1] === 224);
                        assert(reduction[2][0] === 'test3');
                        assert(reduction[2][1] === 220);
                        done();
                    }, 1000);
                });

                it('change view 2', function(done) {
                    v2._identity._key = "junk2_2";
                    c.updateView(v2, done);
                });

                it('saveViews', function(done) {
                    db.saveViews(done);
                });

                it('restart the DB', function(done) {
                    cid = c.getId();
                    vid = v.getId();
                    vid2 = v2.getId();
                    db = new Database(globalSettings, done);
                });

                it('check reduction after restart ', function(done) {
                    setTimeout(function() {
                        c = db.collectionAt(cid);
                        v = c.viewAt(vid);
                        v2 = c.viewAt(vid2);
			var reduction = Array.from(v.reduction.entries());
                        //console.dir(reduction);
                        assert(reduction[0][0] === 'test2');
                        assert(reduction[0][1] === 238);
                        assert(reduction[1][0] === 'test');
                        assert(reduction[1][1] === 224);
                        assert(reduction[2][0] === 'test3');
                        assert(reduction[2][1] === 220);
                        done();
                    }, 0);
                });


                it('viewAt', function(done) {
                    setTimeout(function() {
                        c = db.collectionAt(cid);
                        v = c.viewAt(vid);
                        assert(v === db.viewAt(vid));
                        done();
                    }, 0);
                });

                it('getToken', function(done) {
                    setTimeout(function() {
                        var token, token2;
                        token = db.getToken(vid);
                        token2 = db.getToken(vid);
                        assert(token === token2);
                        done();
                    }, 0);
                });


                it('delete view notfound', function(done) {
                    c.removeView('notfound', function(err) {
                        assert(err instanceof Error);
                        done();
                    });
                });

                it('delete view 2', function(done) {
                    c.removeView(v2.getId(), done);
                });

                it('change the collection', function(done) {
                    c._identity._priority = 7;
                    db.updateCollection(c, done);
                });

                it('clear the collection - no disk', function(done) {
                    c.clear(false, true, done);
                });

                it('reload the documents', function(done) {
                    c.loadDocuments(Array.from(c.views.values()), done);
                });

                it('recheck reduction after restart ', function(done) {
                    setTimeout(function() {
                        c = db.collectionAt(cid);
                        v = c.viewAt(vid);
                        v2 = c.viewAt(vid2);
			var reduction = Array.from(v.reduction.entries());
                        assert(reduction[0][0] === 'test2');
                        assert(reduction[0][1] === 238);
                        assert(reduction[1][0] === 'test');
                        assert(reduction[1][1] === 224);
                        assert(reduction[2][0] === 'test3');
                        assert(reduction[2][1] === 220);
                        done();
                    }, 0);
                });

                it('clear the collection - with disk', function(done) {
                    c.clear(true, true, done);
                });

                it('delete collection', function(done) {
                    db.removeCollection(c.getId(), done);
                });

                it('delete collection (not found)', function(done) {
                    db.removeCollection('notthere', function(err) {
                        if (err instanceof Error) {
                            done();
                        } else {
                            done(new Error('no error returned for invalid collection'));
                        }
                    });
                });

            });

    });
