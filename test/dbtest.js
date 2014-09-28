// © 2014 by Rheosoft. All rights reserved. 
// Licensed under the RTDB Software License version 1.0
/*jslint node: true, white: true, nomen: true */
/*jshint laxbreak: true */
/*global describe, it, before, beforeEach, after, afterEach */
"use strict";
var assert = require('assert');
var argv = require('optimist').argv;
var Identity = require('../identity');
var fs = require('fs.extra');
var expect = require('expect.js');
var Database = require('../db');
var Collection = require('../collection');
var View = require('../view');
var winston = require('winston');
var Tempdir = require('temporary/lib/dir');
var async = require('async');

describe(
    'Suite',
    function () {
        var db = null,
            c = null,
            v = null,
            v2 = null,
            globalSettings = null,
            dir = null,
            cid = null,
            vid = null,
            vid2 = null;
        before(function () {

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
            global.logger = new(winston.Logger)(
                globalSettings.winston.options);

            globalSettings.winston.transports.forEach(function (item) {
                global.logger.add(winston.transports[item[0]], item[1]);
            });

            dir = new Tempdir();
            globalSettings.cfsinit.root = dir.path + '/';
            globalSettings.cfs = 'CFSL';

        });

        after(function () {
            /*jslint stupid: true */
            fs.rmrfSync(dir.path);
            /*jslint stupid: false */
        });

        describe(
            'Database',
            function () {

                it('Create a DB', function (done) {
                    db = new Database(globalSettings, done);
                });

                it('Create a Collection', function (done) {
                    c = new Collection(db).init();
                    db.addCollection(c, done);
                });

                it('Create a document', function (done) {
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
                    c.put(doc, done);
                });

                it(
                    'Create a view',
                    function (done) {
                        v = new View(db, c)
                            .init(
                                'junk',
                                'emit(item.name,item.value)',
                                'emit(values.reduce(function (a, b) { return a + b;}));',
                                'reduction.sort(function(a,b){return b[1] -a[1];});emit(reduction);');
                        c.addView(v, done);
                    });

                it('check reduction', function () {
                    assert(v.reduction[0][0] === 'test');
                    assert(v.reduction[0][1] === 24);
                    assert(v.reduction[1][0] === 'test2');
                    assert(v.reduction[1][1] === 13);

                });

                it('add document', function (done) {
                    var doc = [{
                        name: 'test3',
                        value: 10
                    }, {
                        name: 'test2',
                        value: 15
                    }];
                    c.put(doc, done);
                });

                it('check reduction', function (done) {
                    setTimeout(function () {
                        assert(v.reduction[0][0] === 'test2');
                        assert(v.reduction[0][1] === 28);
                        assert(v.reduction[1][0] === 'test');
                        assert(v.reduction[1][1] === 24);
                        assert(v.reduction[2][0] === 'test3');
                        assert(v.reduction[2][1] === 10);
                        done();
                    }, 1000);
                });

                it('add document', function (done) {
                    var doc = [{
                        name: 'test3',
                        value: 10
                    }, {
                        name: 'test2',
                        value: 10
                    }];
                    c.put(doc, done);
                });

                it('check reduction', function (done) {
                    setTimeout(function () {
                        assert(v.reduction[0][0] === 'test2');
                        assert(v.reduction[0][1] === 38);
                        assert(v.reduction[1][0] === 'test');
                        assert(v.reduction[1][1] === 24);
                        assert(v.reduction[2][0] === 'test3');
                        assert(v.reduction[2][1] === 20);
                        done();
                    }, 100);
                });

                it('add 200 documents', function (done) {
                    var i = 0;
                    async.whilst(function () {
                        i = i + 1;
                        return (i <= 200);
                    }, function (callback) {
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

                it('check reduction again ', function (done) {
                    setTimeout(function () {
                        assert(v.reduction[0][0] === 'test2');
                        assert(v.reduction[0][1] === 238);
                        assert(v.reduction[1][0] === 'test');
                        assert(v.reduction[1][1] === 224);
                        assert(v.reduction[2][0] === 'test3');
                        assert(v.reduction[2][1] === 220);
                        done();
                    }, 1000);
                });

                it(
                    'Create a second view',
                    function (done) {
                        v2 = new View(db, c)
                            .init(
                                'junk2',
                                'emit(item.name,item.value)',
                                'emit(values.reduce(function (a, b) { return a + b;}));',
                                'reduction.sort(function(a,b){return b[1] -a[1];});emit(reduction);');
                        c.addView(v2, done);
                    });

                it('check reduction v2', function (done) {
                    setTimeout(function () {
                        assert(v2.reduction[0][0] === 'test2');
                        assert(v2.reduction[0][1] === 238);
                        assert(v2.reduction[1][0] === 'test');
                        assert(v2.reduction[1][1] === 224);
                        assert(v2.reduction[2][0] === 'test3');
                        assert(v2.reduction[2][1] === 220);
                        done();
                    }, 1000);
                });

                it('change view 2', function (done) {
                    v2._identity._key = "junk2_2";
                    c.updateView(v2, done);
                });

                it('restart the DB', function (done) {
                    cid = c.getId();
                    vid = v.getId();
                    vid2 = v2.getId();
                    db = new Database(globalSettings, done);
                });

                it('check reduction after restart ', function (done) {
                    setTimeout(function () {
                        c = db.collectionAt(cid);
                        v = c.viewAt(vid);
                        v2 = c.viewAt(vid2);
                        assert(v.reduction[0][0] === 'test2');
                        assert(v.reduction[0][1] === 238);
                        assert(v.reduction[1][0] === 'test');
                        assert(v.reduction[1][1] === 224);
                        assert(v.reduction[2][0] === 'test3');
                        assert(v.reduction[2][1] === 220);
                        done();
                    }, 0);
                });

                it('delete view 2', function (done) {
                    c.removeView(v2.getId(), done);
                });

                it('change the collection', function (done) {
                    c._identity._priority = 7;
                    db.updateCollection(c, done);
                });

                it('clear the collection - no disk', function (done) {
                    c.clear(false, true, done);
                });

                it('reload the documents', function (done) {
                    c.loadDocuments(c.views, done);
                });

                it('recheck reduction after restart ', function (done) {
                    setTimeout(function () {
                        c = db.collectionAt(cid);
                        v = c.viewAt(vid);
                        v2 = c.viewAt(vid2);
                        assert(v.reduction[0][0] === 'test2');
                        assert(v.reduction[0][1] === 238);
                        assert(v.reduction[1][0] === 'test');
                        assert(v.reduction[1][1] === 224);
                        assert(v.reduction[2][0] === 'test3');
                        assert(v.reduction[2][1] === 220);
                        done();
                    }, 0);
                });

                it('clear the collection - with disk', function (done) {
                    c.clear(true, true, done);
                });

                it('delete collection', function (done) {
                    db.removeCollection(c.getId(), done);
                });

            });

    });