// © 2014 by Rheosoft. All rights reserved. 
// Licensed under the RTDB Software License version 1.0
/*jslint node: true, white: true, nomen: true */
/*jshint laxbreak: true */
/*global describe, it, before, after*/
"use strict";
var assert = require('assert');
var request = require('request');

var Rtdb = require('../rtdb');
describe('Suite', function () {
  var myrtdb = null;
  
    before(function (done) {
      myrtdb = new Rtdb();
    	myrtdb.start(done);
    	
    });

    after(function (done) {
      myrtdb.stop(done);
    });

    describe('HTTP', function () {

        it('Stats', function (done) {

            request.get({
                url: 'http://localhost:9001/db/admin/stats/',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function (error, response, body) {
                if (!error && response.statusCode === 200) {
                    assert(body._pjson.name === 'rtdb');
                    done();
                } else if (error) {
                    done(error);
                } else {
                    done(new Error('[' + response.statusCode + ']:' + response.body));
                }
            });
        });

        it('Collections', function (done) {
			
			
            request.get({
                url: 'http://localhost:9001/db/collections/',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            },
			function (error, response, body) {
				/*jslint unparam: true */ 
			    if (!error && response.statusCode === 200) {
                    done();
                } else if (error) {
                    done(error);
                } else {
                    done(new Error('[' + response.statusCode + ']:' + response.body));
                }
				
            });
			/*jslint unparam: false */	
            
        });

        it('Collection:Parcel', function (done) {

            request.get({
                url: 'http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function (error, response, body) {
				/*jslint unparam: true */ 
                if (!error && response.statusCode === 200) {
                    done();
                } else if (error) {
                    done(error);
                } else {
                    done(new Error('[' + response.statusCode + ']:' + response.body));
                }
            });
			/*jslint unparam: false */ 
        });

        it('Collection:Parcel Views', function (done) {

            request.get({
                url: 'http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function (error, response, body) {
				/*jslint unparam: true */ 
                if (!error && response.statusCode === 200) {
                    done();
                } else if (error) {
                    done(error);
                } else {
                    done(new Error('[' + response.statusCode + ']:' + response.body));
                }
            });
			/*jslint unparam: false */ 
        });



        it('Collection:Parcel Views', function (done) {

            request.get({
                url: 'http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function (error, response, body) {
				/*jslint unparam: true */ 
                if (!error && response.statusCode === 200) {
                    done();
                } else if (error) {
                    done(error);
                } else {
                    done(new Error('[' + response.statusCode + ']:' + response.body));
                }
            });
			/*jslint unparam: false */ 
        });
        it('Collection:Parcel View:Zipcode', function (done) {

            request.get({
                url: 'http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/18823768-0635-49bc-9053-ac2f212d066b',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function (error, response, body) {
				/*jslint unparam: true */ 
                if (!error && response.statusCode === 200) {
                    done();
                } else if (error) {
                    done(error);
                } else {
                    done(new Error('[' + response.statusCode + ']:' + response.body));
                }
            });
			/*jslint unparam: false */ 
        });
        it('Collection:Parcel View:Zipcode Reduction', function (done) {

            request.get({
                url: 'http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/18823768-0635-49bc-9053-ac2f212d066b/reduction/',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function (error, response, body) {
				/*jslint unparam: true */ 
                if (!error && response.statusCode === 200) {
                    done();
                } else if (error) {
                    done(error);
                } else {
                    done(new Error('[' + response.statusCode + ']:' + response.body));
                }
            });
			/*jslint unparam: false */ 
        });
    });
});