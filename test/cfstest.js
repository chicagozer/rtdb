// © 2014 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
/*jslint node: true, white: true, nomen: true */
/*jshint laxbreak: true */
/*global describe, it, before, after */
"use strict";
var winston = require('winston');

var argv = require('optimist').argv;
var Identity = require('../identity');
var fs = require('fs');
var tmp = require('temporary');
var assert = require('assert');


describe('CFS plugins', function() {
    var dn = 'junk/',
        id = null,
        dir = null,
        globalSettings = null,
        cfsTypes = [];

    before(function() {

        /*jslint stupid: true */

        if (argv.settings) {
            globalSettings = JSON.parse(fs.readFileSync(argv.settings));
        } else if (process.env.MOCHA_SETTINGS) {
            globalSettings = JSON.parse(fs.readFileSync(process.env.MOCHA_SETTINGS));
        } else {
            globalSettings = JSON.parse(fs.readFileSync('settings/mocha.json'));
        }
        global.logger = winston.createLogger(globalSettings.winston.options);
        globalSettings.winston.transports.forEach(function(item) {
                global.logger.add(new winston.transports[item[0]](item[1]) );
            });

        dir = new tmp.Dir();
        globalSettings.cfsinit.root = dir.path;

        var cfslist = fs.readdirSync('cfs');

        /*jslint stupid: false */

        cfslist.forEach(function(file) {
            var mycfs, Cfs = require('../cfs/' + file);

            mycfs = new Cfs();
            if (mycfs.init && mycfs.init(globalSettings.cfsinit) ) {
                cfsTypes.push(mycfs);
            }
        });

    });

    // this is very hoary. To dynamically create the tests, we need to have this
    // nesting in place. For some reason mocha calls the describe code before
    // calling
    // the before function
    //
    // anyway, this seems to do the trick
    describe('OuterLoop', function() {

        it('Iteration Test', function() {

            cfsTypes.forEach(function(cfs) {

                describe('InnerLoop', function() {

                    it(cfs.name + ': should create a file', function(done) {
                        id = new Identity();

                        cfs.put(dn, id, done);
                    });

                    it(cfs.name + ': should fetch a file', function(done) {
                        cfs.get(dn + id._id + '.json', done);
                    });

                    it(cfs.name + ': should list files', function(done) {
                        cfs.list(dn, done);
                    });

                    it(cfs.name + ': should exist', function(done) {
                        cfs.exists(dn, function(exists) {
                            assert(exists);
                            done();
                        });
                    });

                    it(cfs.name + ': should delete file', function(done) {
                        var fn = dn + id._id + '.json';
                        cfs.del(fn, done);
                    });

                    it(cfs.name + ': should create a file with expiration', function(done) {
                        id = new Identity();

                        cfs.put(dn, id, done, 1);
                    });


                    it(cfs.name + ': get name', function(done) {
                        assert(cfs.name().length > 0);
                        done();
                    });
                });
            });
        });
    });

    after(function() {
        if (dir) {
            fs.rmSync(dir.path, { recursive: true });
        }
    });

});
