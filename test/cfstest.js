// © 2014 by Rheosoft. All rights reserved. 
// Licensed under the RTDB Software License version 1.0
var winston = require('winston');
var assert = require('assert');

var argv = require('optimist').argv;
var Identity = require('../identity');
var fs = require('fs');
var expect = require('expect.js');
var Tempdir = require('temporary/lib/dir');

describe('CFS plugins', function() {
	var dn = 'junk/';
	var id = null;
	var settings;
	var dir = null;
	var cfsTypes = [];

	before(function() {

		if (argv.settings)
			settings = JSON.parse(fs.readFileSync(argv.settings));
		else if (process.env.MOCHA_SETTINGS)
			settings = JSON.parse(fs.readFileSync(process.env.MOCHA_SETTINGS));
		else
			settings = JSON.parse(fs.readFileSync('settings/mocha.json'));

		logger = new (winston.Logger)(settings.winston.options);
		dir = new Tempdir;
		settings.cfsinit.root = dir.path;

		var cfslist = fs.readdirSync('cfs');
		cfslist.forEach(function(file) {
			var cfs = require('../cfs/' + file);

			var mycfs = new cfs();
			if (mycfs.init) {
				mycfs.init(settings.cfsinit);
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

					it(cfs.name + ': should delete file', function(done) {
						var fn = dn + id._id + '.json';
						cfs.del(fn, done);
					});
				});
			});
		});
	});

	after(function() {
		if (dir)
			dir.rmdir();
	});

});
