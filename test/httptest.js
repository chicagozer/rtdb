// © 2014 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
/*jslint node: true, white: true, nomen: true */
/*jshint laxbreak: true */
/*global describe, it, before, after*/
"use strict";
var assert = require('assert');
var request = require('request');
var EventSource = require('eventsource');
var fs = require('fs');



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


        function get(url, status, done) {
            request.get({
                url: url,
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true
            }, function(error, response, body) {
                if (!error && response.statusCode === status) {
                    done();
                } else if (error) {
                    done(error);
                } else {
                    done(new Error('[' + response.statusCode + ']:' + response.body));
                }
            });
        }
        
        function post(url, data, status, done) {
            request.post({
                url: url,
                auth: {
                    user: 'admin',
                    pass: 'chang3m3'
                },
                json: true,
                body: data
            }, function(error, response, body) {
                if (!error && response.statusCode === status) {
                    done();
                } else if (error) {
                    done(error);
                } else {
                    done(new Error('[' + response.statusCode + ']:' + response.body));
                }
            });
        }

        it('about', function(done) {
            get('http://localhost:9001/about', 200, done);
        });

        it('echo', function(done) {
            get('http://localhost:9001/db/admin/echo', 200, done);
        });

        it('index', function(done) {
            get('http://localhost:9001/index', 200, done);
        });
        it('home', function(done) {
            get('http://localhost:9001/', 200, done);
        });

        it('web', function(done) {
            get('http://localhost:9001/web', 200, done);
        });
        it('web/admin/stats', function(done) {
            get('http://localhost:9001/web/admin/stats', 200, done);
        });

        it('web/collections', function(done) {
            get('http://localhost:9001/web/collections', 200, done);
        });


        it('db/stream (not found)', function(done) {
            get('http://localhost:9001/db/stream', 404, done);
        });



        it('db/admin/stats', function(done) {
            get('http://localhost:9001/db/admin/stats/', 200, done);
        });


        it('db/collections', function(done) {
            get('http://localhost:9001/db/collections/', 200, done);
        });



        it('db/collections/:parcel', function(done) {
            get('http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0', 200, done);
        });


        it('web/collections/:parcel', function(done) {
            get('http://localhost:9001/web/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0', 200, done);
        });


        it('web/collections/:parcel/views', function(done) {
            get('http://localhost:9001/web/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views', 200, done);
        });


        it('web/collections/:notfound/views', function(done) {
            get('http://localhost:9001/web/collections/notfound/views', 404, done);
        });


        it('/db/collections/:parcel/stats', function(done) {
            get('http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/stats', 200, done);
        });

        it('/db/collections/:notfound', function(done) {
            get('http://localhost:9001/db/collections/notfound', 404, done);
        });



        it('/db/stream/:apples', function(done) {

            var es = new EventSource('http://localhost:9001/db/stream?view=ec537999-60a5-41f3-9036-fcd3d5356ae2');

            es.addEventListener("ec537999-60a5-41f3-9036-fcd3d5356ae2",
                function(event) {
                    es.close();
                    done();
                }, false);
        });

        it('/db/collections/:parcels/views/:borough/stream', function(done) {

            var es = new EventSource('http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/18823768-0635-49bc-9053-ac2f212d066b/stream');

            es.addEventListener("18823768-0635-49bc-9053-ac2f212d066b",
                function(event) {
                    es.close();
                    done();
                }, false);
        });

        it('/db/collections/:notfound/views/:borough/stream', function(done) {

            assert(new EventSource('http://localhost:9001/db/collections/notfound/views/18823768-0635-49bc-9053-ac2f212d066b/stream'));

            done();
        });

        it('/db/stream/:multiple', function(done) {

            assert(new EventSource('http://localhost:9001/db/stream?view=ec537999-60a5-41f3-9036-fcd3d5356ae2&view=18823768-0635-49bc-9053-ac2f212d066b'));

            done();
        });

        it('/db/stream/:delta', function(done) {

            assert(new EventSource('http://localhost:9001/db/stream?view=ec537999-60a5-41f3-9036-fcd3d5356ae2&delta=true'));

            done();
        });

        it('/db/collections/:parcels/views/:notfound/stream', function(done) {
            get('http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/notfound/stream', 404, done);
        });



        it('/db/collections/:parcels/views', function(done) {
            get('http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views', 200, done);
        });


        it('/db/collections/:parcels/views/:zipcode', function(done) {
            get('http://localhost:9001/web/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/18823768-0635-49bc-9053-ac2f212d066b', 200, done);
        });


        it('/db/collections/:parcels/views/:zipcode/subscriptions', function(done) {
            get('http://localhost:9001/web/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/18823768-0635-49bc-9053-ac2f212d066b/subscriptions', 200, done);
        });

        it('/db/collections/:parcels/views/:notfound/subscriptions', function(done) {
            get('http://localhost:9001/web/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/notfound/subscriptions', 404, done);
        });

        it('/db/collections/stream', function(done) {
            get('http://localhost:9001/db/collections/stream', 404, done);
        });


        it('/db/collections/:notfound/documents/stream', function(done) {
            get('http://localhost:9001/db/collections/notfound/documents/stream', 404, done);
        });

        it('/db/collections/:parcels/views/:zipcode', function(done) {
            get('http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/18823768-0635-49bc-9053-ac2f212d066b', 200, done);
        });

        it('/db/collections/:parcels/views/:zipcode/stats', function(done) {
            get('http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/18823768-0635-49bc-9053-ac2f212d066b/stats', 200, done);
        });

        it('/db/collections/:notfound/views/:zipcode/status', function(done) {
            get('http://localhost:9001/db/collections/notfound/views/18823768-0635-49bc-9053-ac2f212d066b/stats', 404, done);
        });

        it('/db/collections/:parcels/views/:notfound/status', function(done) {
            get('http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/notfound/stats', 404, done);
        });


        it('/db/collections/:parcels/views/:zipcode/ticket', function(done) {
            get('http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/18823768-0635-49bc-9053-ac2f212d066b/ticket', 200, done);
        });

        it('/db/collections/:parcels/views/:zipcode/subscriptions', function(done) {
            get('http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/18823768-0635-49bc-9053-ac2f212d066b/subscriptions', 200, done);
        });


        it('/db/collections/:parcels/views/:notfound/subscriptions', function(done) {
            get('http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/notfound/subscriptions', 404, done);
        });


        it('/db/collections/:parcels/views/:zipcode/reduction', function(done) {
            get('http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/18823768-0635-49bc-9053-ac2f212d066b/reduction', 200, done);
        });

        it('/web/collections/:parcels/views/:zipcode/reduction', function(done) {
            get('http://localhost:9001/web/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/18823768-0635-49bc-9053-ac2f212d066b/reduction', 200, done);
        });

        it('/web/collections/:parcels/views/:notfound/reduction', function(done) {
            get('http://localhost:9001/web/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/views/notfound/reduction', 404, done);
        });


        it('/db/collections/:parcels/load', function(done) {

          var data;
          post('http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/load',
                data, 200, done);
        });

        it('/db/collections/:notfound/load', function(done) {
          var data;
          post( 'http://localhost:9001/db/collections/notfound/load',
          data,404,done);
        });

        it('help', function(done) {
            get('http://localhost:9001/help/intro', 200, done);
        });

        it('demo', function(done) {
            get('http://localhost:9001/demo/parcels', 200, done);
        });


        it('/db/collectiosn/:parcels/documents - add', function(done) {
            var samplefile = "sampledb/parcels/1ffffebf-755b-49a0-a5ef-3793c748718f.json";

            fs.readFile(samplefile, 'utf-8', function(err, data) {
                if (err) {
                    done(err);
                    return;
                }
                post('http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/documents',
                    data, 201, done);
            });
        });

        it('/db/collectiosn/parcels/documents - add array', function(done) {
            var samplefile = "sampledb/parcels/1ffffebf-755b-49a0-a5ef-3793c748718f.json";

            fs.readFile(samplefile, 'utf-8', function(err, data) {
                if (err) {
                    done(err);
                    return;
                }

                post('http://localhost:9001/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/documents',
                     [JSON.parse(data)], 201, done);
            });
        });

        it('/db/collectiosn/parcels/documents - add notfound', function(done) {
            var samplefile = "sampledb/parcels/1ffffebf-755b-49a0-a5ef-3793c748718f.json";

            fs.readFile(samplefile, 'utf-8', function(err, data) {
                if (err) {
                    done(err);
                    return;
                }
                post('http://localhost:9001/db/collections/notfound/documents',
                data,404,done);
            });
        });
    });
});
