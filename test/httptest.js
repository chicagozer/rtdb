// © 2014 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
/*jslint node: true, white: true, nomen: true */
/*jshint laxbreak: true */
/*global describe, it, before, after*/
"use strict";
var assert = require('assert');
var request = require('request');
var EventSource = require('eventsource');



var Rtdb = require('../rtdb');
describe('Suite', function() {
    var myrtdb = null;

    before(function(done) {
        myrtdb = new Rtdb();
        myrtdb.start(done);

    });

    after(function(done) {
        myrtdb.stop(done);
    });

   	
	    describe('HTTP', function() {
			
			
	        it('about', function(done) {

	            request.get({
	                url: 'http://localhost:9001/about',
	                auth: {
	                    user: 'admin',
	                    pass: 'chang3m3'
	                },
	                json: true
	            }, function(error, response, body) {
	                if (!error && response.statusCode === 200) {
	                    done();
	                } else if (error) {
	                    done(error);
	                } else {
	                    done(new Error('[' + response.statusCode + ']:' + response.body));
	                }
	            });
	        });	
			
		
	        it('echo', function(done) {

	            request.get({
	                url: 'http://localhost:9001/db/admin/echo',
	                auth: {
	                    user: 'admin',
	                    pass: 'chang3m3'
	                },
	                json: true
	            }, function(error, response, body) {
	                if (!error && response.statusCode === 200) {
	                    done();
	                } else if (error) {
	                    done(error);
	                } else {
	                    done(new Error('[' + response.statusCode + ']:' + response.body));
	                }
	            });
	        });
		
        it('index', function(done) {

            request.get({
                url: 'http://localhost:9001/index',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
                if (!error && response.statusCode === 200) {
                    done();
                } else if (error) {
                    done(error);
                } else {
                    done(new Error('[' + response.statusCode + ']:' + response.body));
                }
            });
        });
		
        it('home', function(done) {

            request.get({
                url: 'http://localhost:9001/',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
                if (!error && response.statusCode === 200) {
                    done();
                } else if (error) {
                    done(error);
                } else {
                    done(new Error('[' + response.statusCode + ']:' + response.body));
                }
            });
        });
		
        it('web', function(done) {

            request.get({
                url: 'http://localhost:9001/web',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
                if (!error && response.statusCode === 200) {
                    done();
                } else if (error) {
                    done(error);
                } else {
                    done(new Error('[' + response.statusCode + ']:' + response.body));
                }
            });
        });
		
        it('web/admin/stats', function(done) {

            request.get({
                url: 'http://localhost:9001/web/admin/stats',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
                if (!error && response.statusCode === 200) {
                    done();
                } else if (error) {
                    done(error);
                } else {
                    done(new Error('[' + response.statusCode + ']:' + response.body));
                }
            });
        });
		
        it('web/collections', function(done) {

            request.get({
                url: 'http://localhost:9001/web/collections',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
                if (!error && response.statusCode === 200) {
                    done();
                } else if (error) {
                    done(error);
                } else {
                    done(new Error('[' + response.statusCode + ']:' + response.body));
                }
            });
        });
		
	    it('Stream (not found)', function(done) {

            request.get({
                url: 'http://localhost:9001/db/stream',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
                if (!error && response.statusCode === 404) {
                    done();
                } else if (error) {
                    done(error);
                } else {
                    done(new Error('[' + response.statusCode + ']:' + response.body));
                }
            });
        });
		

        it('Stats', function(done) {

            request.get({
                url: 'http://localhost:9001/db/admin/stats/',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
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

        it('Collections', function(done) {


            request.get({
                    url: 'http://localhost:9001/db/collections/',
                    auth: {
                        user: 'admin',
                        pass: 'chang3m3'
                    },
                    json: true
                },
                function(error, response, body) {
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

        it('Collection:Parcel', function(done) {

            request.get({
                url: 'http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
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
		
        it('web Collection:Parcel', function(done) {

            request.get({
                url: 'http://localhost:9001/web/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
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
		
        it('web Collection:Parcel views', function(done) {

            request.get({
                url: 'http://localhost:9001/web/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
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
		
        it('Collection:Parcel stats', function(done) {

            request.get({
                url: 'http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/stats',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
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
		
        it('stream Collection:(not found)', function(done) {

            request.get({
                url: 'http://localhost:9001/db/collections/notfound',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
                /*jslint unparam: true */
                if (!error && response.statusCode === 404) {
                    done();
                } else if (error) {
                    done(error);
                } else {
                    done(new Error('[' + response.statusCode + ']:' + response.body));
                }
            });
            /*jslint unparam: false */
        });
		
		
	    it('stream Collection:Apples', function(done) {

			var es = new EventSource('http://localhost:9001/db/stream?view=ec537999-60a5-41f3-9036-fcd3d5356ae2');
			
	        es.addEventListener("ec537999-60a5-41f3-9036-fcd3d5356ae2",
	        function(event) {
				es.close();
				done();
	        }, false);
	    });
		
	    it('stream Collection:Parcels', function(done) {

			var es = new EventSource('http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/18823768-0635-49bc-9053-ac2f212d066b/stream');
			
	        es.addEventListener("18823768-0635-49bc-9053-ac2f212d066b",
	        function(event) {
				es.close();
				done();
	        }, false);
	    });
		
	    it('stream Collection:notfound', function(done) {

			var es = new EventSource('http://localhost:9001/db/collections/notfound/views/18823768-0635-49bc-9053-ac2f212d066b/stream');
			
	       done();
	    });
		
	    it('stream Collection:multiple', function(done) {

			var es = new EventSource('http://localhost:9001/db/stream?view=ec537999-60a5-41f3-9036-fcd3d5356ae2&view=18823768-0635-49bc-9053-ac2f212d066b');
			
			done();
	    });
		
	    it('stream Collection:delta', function(done) {

			var es = new EventSource('http://localhost:9001/db/stream?view=ec537999-60a5-41f3-9036-fcd3d5356ae2&delta=true');
			
			done();
	    });
		
        it('stream Collection:Parcel:(view not found)', function(done) {

            request.get({
                url: 'http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/notfound/stream',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
                /*jslint unparam: true */
                if (!error && response.statusCode === 404) {
                    done();
                } else if (error) {
                    done(error);
                } else {
                    done(new Error('[' + response.statusCode + ']:' + response.body));
                }
            });
            /*jslint unparam: false */
        });
		

        it('Collection:Parcel Views', function(done) {

            request.get({
                url: 'http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
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
		
        it('web Collection:Parcel View:Zipcode', function(done) {

            request.get({
                url: 'http://localhost:9001/web/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/18823768-0635-49bc-9053-ac2f212d066b',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
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
		
        it('web Collection:Parcel View:Zipcode subscriptions', function(done) {

            request.get({
                url: 'http://localhost:9001/web/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/18823768-0635-49bc-9053-ac2f212d066b/subscriptions',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
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
		
		
        it('Collection:Parcel View:Zipcode', function(done) {

            request.get({
                url: 'http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/18823768-0635-49bc-9053-ac2f212d066b',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
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
		
		
        it('Collection:Parcel View:Zipcode stats', function(done) {

            request.get({
                url: 'http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/18823768-0635-49bc-9053-ac2f212d066b/stats',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
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
		
        it('Collection:Parcel View:Zipcode ticket', function(done) {

            request.get({
                url: 'http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/18823768-0635-49bc-9053-ac2f212d066b/ticket',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
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
		
        it('Collection:Parcel reload', function(done) {

            request.post({
                url: 'http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/load',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
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
		
        it('Collection:Parcel reload (notfound)', function(done) {

            request.post({
                url: 'http://localhost:9001/db/collections/notfound/load',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
                /*jslint unparam: true */
                if (!error && response.statusCode === 404) {
                    done();
                } else if (error) {
                    done(error);
                } else {
                    done(new Error('[' + response.statusCode + ']:' + response.body));
                }
            });
            /*jslint unparam: false */
        });
		
        it('help', function(done) {

            request.get({
                url: 'http://localhost:9001/help/intro',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
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
		
        it('demo', function(done) {

            request.get({
                url: 'http://localhost:9001/demo/parcels',
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
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
