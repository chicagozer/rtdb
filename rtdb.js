// © 2014 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
/*jslint node: true, white: true, nomen: true */
/*jshint laxbreak: true */
"use strict";
var express = require('express');
var compression = require('compression')
var auth = require('http-auth');
var errorHandler = require('errorhandler');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var Database = require('./db');
var Collection = require('./collection');
var View = require('./view');
var Identity = require('./identity');
var argv = require('optimist').argv;
var fs = require('fs');
var path = require('path');
var winston = require('winston');
var http = require('http');
var Symmetry = require('symmetry');
require('core-js/fn/array/from');

function Rtdb() {
    this.servers = [];
}



// helper function to add a stream. We call it from a couple places
function addStream(req, res, view, delta) {
    // save a reference to our subscriber
    var myReduction, data, sub;

    sub = {
        res: res
    };

    // give him an identity and save his headers
    // note we will use the headers for our "personalization"
    // stage in the pipeline
    sub._identity = new Identity();
    sub._identity.headers = req.headers;
    sub._identity.delta = delta;

    // throw this in our hash
    view.subscriptions[sub._identity._id] = sub;

    function drain() {
        var draindata;
        global.logger.log('info', 'drain - subscription:', sub._identity._id);
        if (sub.data) {
            if (sub._identity.delta) {
                draindata = Symmetry.diff(sub.last, sub.data);
            } else {
                draindata = sub.data;
            }

            sub.last = sub.data;

            res.write('event: ');
            res.write(view._identity._id + '\n');
            res.write("data: ");
            sub.overflow = !res.write(JSON.stringify(draindata) + '\n\n');
        }
        delete sub.data;
    }

    // if we lose a subscriber, take it out of the hash
    function remove() {
        delete view.subscriptions[sub._identity._id];
    }
    res.on('end', remove);
    res.on('close', remove);
    res.on('drain', drain);

    // get the reduction
    myReduction = view.personalize(sub._identity._id);
    data = JSON.stringify(myReduction);
    if (sub._identity.delta) {
        sub.last = myReduction;
    }

    // NOTE we need to break this up or express escape encodes
    // it. must
    // think it's a header!
    res.write('event: ');
    res.write(view._identity._id + '\n');
    res.write("data: ");
    sub.overflow = !res.write(data + '\n\n');

}



/** loadExpress methods */
function loadExpress(rtdb, database, startTime, done) {

    var basic, env, server, app = express();
    global.logger.log('debug', 'Database.loadExpress - started.');

    // lets cap the # of sockets at a reasonable # so we don't run out of
    // filehandles
    if (database.globalSettings.maxSockets) {
        global.logger.log('debug', 'Database.loadExpress - maxSockets:',
            database.globalSettings.maxSockets);
        http.globalAgent.maxSockets = database.globalSettings.maxSockets;
    }
    // if you want to handle POSTS, you need this
    // add all the plugins
    app.use(bodyParser.json({
        limit: '50mb'
    }));
    app.use(bodyParser.urlencoded({
        extended: true,
        limit: '50mb'
    }));
    app.use(methodOverride());

    // serve up statics if we aren't running under another web server
    // I think this is clever
    app.use(compression());  
    app.use(express.static(__dirname + path.sep + 'public'));
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.set('wsport', database.globalSettings.wsport);

    env = process.env.NODE_ENV || 'development';
    if ('development' === env) {
        app.use(errorHandler());
        app.locals.pretty = true;
    }

    basic = auth.basic({
        realm: "rtdb"
    }, function(username, password, callback) {
        // Custom authentication method.
        var reply;

        if (database.getSettings().disableBasicAuth) {
            reply = true;
        }

        reply = username === (process.env.RTDBADMIN_USER || 'admin') && password === (process.env.RTDBADMIN_PWD || 'chang3m3');
        callback(reply);
    });

    app.all('/web/*', auth.connect(basic));
    app.all('/db/admin/*', auth.connect(basic));


    app.get('/db/stream', function(req, res) {

        var vlist = [],
            verrlist = [],
            vidlist = [],
            ticketlist = [],
            delta = false,
            errticket = [],
            fail = false;
        // pull out the list of views
        // maybe it's an array or just a single
        if (Array.isArray(req.query.view)) {
            vidlist = req.query.view;
            ticketlist = req.query.ticket;
        } else {
            vidlist.push(req.query.view);
            ticketlist.push(req.query.ticket);
        }

        if (req.query.delta === 'true') {
            delta = true;
        }

        // for each view id, go find the actual view
        vidlist.forEach(function(vid) {
            var view = database.viewAt(vid);
            if (!view) {
                global.logger.log('warn', 'Database.stream - view [' + vid + '] not found.');
                verrlist.push(vid);
            } else {
                vlist.push(view);
            }
        });

        // if we didn't come back with the same # of views was requested
        // bail out with a not found.
        if (vlist.length !== vidlist.length) {
            res.status(404).send("Some views not found:" + verrlist);
            return;
        }

        if (database.getSettings().useACLTicket) {

            if (ticketlist.length !== vlist.length) {
                res.status(403).send("You must supply a ticket for each view.");
                return;
            }



            vlist.forEach(function(view, index) {
                if (!view.checkTicket(ticketlist[index])) {
                    fail = true;
                }
            });
            if (fail) {
                res.status(403).send("Invalid ticket(s):" + errticket);
                return;
            }
        }
        global.logger.log('debug', 'app.get stream: writing stream!!');
        // setup the SEE
        if (res.setTimeout) {
            res.setTimeout(0);
        }
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        });

        // LATER maybe make this a setting
        res.write("retry: 1000\n");

        // for each view in our list
        vlist.forEach(function(v) {
            addStream(req, res, v, delta);
        });
    });

    // write the headers; diagnostic function
    app.get('/db/admin/echo', function(req, res) {
        res.send(req.headers);
    });

    // quick little function that will shutdown the DB
    /*jslint unparam:true */
    app.post('/db/admin/stop', function(req, res) {
        database.saveViews(function(err) {
            process.exit();
        });
        res.status(202).end();
    });
    /*jslint unparam:false */
    /*jslint unparam:true */
    app.post('/db/admin/gc', function(req, res) {
        if (global.gc) {
            global.gc();
            global.logger.log('info', 'gc - gc called.');
        } else {
            global.logger.log('warn', 'gc - set --enable-gc to allow gc.');
        }
        global.logger.log('info', 'gc - ' + JSON.stringify(process.memoryUsage()));

        res.send(process.memoryUsage());
    });
    /*jslint unparam:false */
    // method to reload the documents
    // useful if we are messing with the disk
    app.post('/db/collections/:id/load', function(req, res) {
        var c = database.collectionAt(req.params.id);
        if (!c) {
            res.status(404).send("collection " + req.params.id + " is not in the database.");
            return;
        }
        // reset the collection
        c.clear(false, false, function(err) {
            if (err) {
                res.status(500).send(err);
                return;
            }
            c.loadDocuments(Array.from(c.views.values()), function(err) {
                if (!err) {
                    res.status(200).end();
                } else {
                    res.status(500).send(err);
                }
            });
        });
    });

    // add a document or array of documents
    app.post('/db/collections/:id/documents', function(req, res) {

        var docs = [],
            c = database.collectionAt(req.params.id);
        if (!c) {
            res.status(404).send("collection " + req.params.id + " is not in the database.");
            return;
        }

        if (!Array.isArray(req.body)) {
            docs.push(req.body);
        } else {
            docs = req.body;
        }

        c.put(docs, function(err) {
            if (!err) {
                res.status(201).end();
            } else {
                res.status(500).send(err);
            }
        });
    });

    function updateDatabaseStats(database) {
          // get current memory and uptime
        database.getIdentity().hosts = database.globalSettings.hosts;
        database.getIdentity().port = database.globalSettings.port;
        database.getIdentity().memory = process.memoryUsage();
        database.getIdentity().uptime = process.uptime();
        database.getIdentity().dirname = __dirname;

        // LATER merge this with the web version
        var val = { totalReduceTime : 0 , collections: {}};
        database.collections.forEach(function(value, key) {
            val.collections[key] = value.getStats();
            val.totalReduceTime += val.collections[key].stats.totalReduceTime;
        });

        database.getIdentity().stats = val;
    }
        

    // serve up some stats
    /*jslint unparam:true */
    app.get("/db/admin/stats", function(req, res) {

        updateDatabaseStats(database);
        res.send(database.getIdentity());

    });
    /*jslint unparam:false */

    // this is the standard way to get to a stream
    app.get('/db/collections/:cid/views/:vid/stream', function(req, res) {

        var view, c = database.collectionAt(req.params.cid);
        if (!c) {
            res.status(404).send("collection " + req.params.cid + " is not in the database.");
            return;
        }

        view = c.viewAt(req.params.vid);

        if (!view) {
            res.status(404).send("view " + req.params.vid + " is not in the collection.");
            return;
        }

        res.setTimeout(0);
        // setup the SEE
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        });

        // LATER maybe make this a setting
        res.write("retry: 1000\n");

        // add the stream
        addStream(req, res, view);
    });

    /*jslint unparam:true */

    app.get('/about', function(req, res) {
        res.render('about');
    });

    app.get('/help/:id', function(req, res) {
        res.render('help/' + req.params.id);
    });

    app.get('/index', function(req, res) {
        res.render('index', {
            json: database._identity
        });
    });

    app.get('/demo/:dpage', function(req, res) {
        res.render(req.params.dpage, {
            json: database._identity
        });
    });

    // home page
    app.get("/", function(req, res) {
        res.render('home', {
            json: database._identity
        });
    });

    // main web page
    app.get("/web", function(req, res) {
        res.render('main', {
            json: database._identity
        });
    });
    /*jslint unparam:false */

    function getCollection(database, req, res) {
        var c = database.collectionAt(req.params.cid);
        if (!c) {
            res.status(404).send("collection " + req.params.cid + " is not in the database.");
        }
        return c;
    }

    function getView(database, req, res) {
        var view, c = getCollection(database, req, res);
        if (!c) {
            return c;
        }
        view = c.viewAt(req.params.vid);
        if (!view) {
            res.status(404).send("view " + req.params.vid + " is not in the collection.");
        }
        return view;
    }




    app.get('/db/collections/:cid/views/:vid/stats', function(req, res) {

        var view = getView(database, req, res);
        if (view) {
            res.send(view.stats);
        }
    });

    app.get('/db/collections/:cid/views/:vid/ticket', function(req, res) {

        var view = getView(database, req, res);
        if (view) {
            res.send(JSON.stringify({
                ticket: view.issueTicket()
            }));
        }
    });

    /** collection stats */
    app.get('/db/collections/:cid/stats', function(req, res) {

        var c = getCollection(database, req, res);
        if (c) {
            res.send(c.getStats());
        }
    });

    /** templated db stats */
    /*jslint unparam:true */

    app.get("/web/admin/stats", function(req, res) {

        updateDatabaseStats(database);
        res.render('stats', {
            json: database.getIdentity()
        });

    });
    /*jslint unparam:false */


    /** templated list of collections */
    /*jslint unparam:true */

    app.get('/web/collections', function(req, res) {
        var list = [];
        Array.from(database.collections.values()).forEach(function(item) {
            list.push(item.getIdentity());
        });

        res.render('collections', {
            json: list
        });

    });
    /*jslint unparam:false */

    /** templated collection */

    /*jslint unparam:true */

    app.get('/web/collections/:cid', function(req, res) {
        var c = getCollection(database, req, res);
        if (c) {
            res.render('collection', {
                json: c._identity
            });
        }
    });
    /*jslint unparam:false */


    /** templated list of views */

    app.get('/web/collections/:cid/views', function(req, res) {
        var list = [],
            c = getCollection(database, req, res);
        if (!c) {
            return;
        }
        Array.from(c.views.values()).forEach(function(item) {
            list.push(item._identity);
        });
        res.render('views', {
            json: list,
            cid: c._identity._id
        });
    });

    // templated view
    app.get('/web/collections/:cid/views/:vid', function(req, res) {
        var view = getView(database, req, res);
        if (view) {
            res.render('view', {
                json: view._identity,
                cid: req.params.cid
            });
        }
    });

    // templated reduction
    app.get('/web/collections/:cid/views/:vid/reduction', function(req,
        res) {
        var view = getView(database, req, res);
        if (!view) {
            return;
        }

        res.render('reduction', {
            json: Array.from(view.reduction.entries()),
            cid: req.params.cid,
            vid: req.params.vid,
            rid: view._redcontainer._identity._id
        });
    });
    
    // templated stats
    app.get('/web/collections/:cid/stats', function(req,
        res) {
        var c = getCollection(database, req, res);
        if (!c) {
            return;
        }

        res.render('cstats', {
            json: c.getStats(),
            cid: req.params.cid
        });
    });

    // templated stats 
    app.get('/web/collections/:cid/views/:vid/stats', function(req,
        res) {
        var view = getView(database, req, res);
        if (!view) {
            return;
        }

        res.render('vstats', {
            json: view.stats,
            cid: req.params.cid,
            vid: req.params.vid,
            rid: view._redcontainer._identity._id
        });
    });

    // return templated list of subscriptions
    app.get('/web/collections/:cid/views/:vid/subscriptions', function(
        req, res) {
        var index, list = [],
            view = getView(database, req, res);

        if (!view) {
            return;
        }
        for (index in view.subscriptions) {
            if (view.subscriptions.hasOwnProperty(index)) {
                list.push(view.subscriptions[index]._identity);
            }
        }
        res.render('subscriptions', {
            json: list,
            cid: req.params.cid,
            vid: req.params.vid
        });
    });

    // get a list of collections
    /*jslint unparam:true */

    app.get('/db/collections', function(req, res) {

        var list = [];
        Array.from(database.collections.values()).forEach(function(item) {
            list.push(item._identity);
        });
        res.send(list);
    });


    app.get('/db/collections/stream', function(req, res) {

        // LATER STREAM changes to the collections
        res.status(404).send("Method not yet implemented.");
    });

    app.get('/db/collections/:id/documents/stream', function(req, res) {

        // LATER STREAM documents
        res.status(404).send("Method not yet implemented.");
    });

    /*jslint unparam:false */

    // add collection

    app.post('/db/collections', function(req, res) {

        var c;
        if (req.body._id) {
            c = new Collection(database, req.body);
        } else {
            c = new Collection(database).init();
        }

        database.addCollection(c, function(err) {
            if (err) {
                global.logger.log('error', 'app.post - collections', err);
                res.status(500).send(err);
            } else {
                res.status(201).send(c._identity);
            }
        });
    });

    // add a view

    app.post('/db/collections/:cid/views', function(req, res) {

        global.logger.debug('App.post - adding view to ' + req.params.id);
        var v, c = getCollection(database, req, res);
        if (!c) {
            return;
        }

        if (req.body._id) {
            v = new View(database, c, req.body);

        } else {
            v = new View(database, c).init();
        }
        c.addView(v, function(err) {
            if (err) {
                global.logger.log('error', 'app.post - collections/view: ' + req.params.id + '/' + req.params.vid, err);
                res.status(500).send(err);
            } else {
                res.status(201).send(v.getIdentity());
            }
        });
    });

    // update an existing collection
    app.put('/db/collections/:cid', function(req, res) {

        var c = getCollection(database, req, res);
        if (!c) {
            return;
        }
        c.init(req.body._key, req.body._transient, req.body._priority,
            req.body._expiration, req.body._onAdd);
        database.updateCollection(c, function(err) {
            if (err) {
                res.status(500).send(err);
            } else {
                res.status(200).end();
            }
        });
    });

    // remove an existing collection
    app.delete('/db/collections/:cid', function(req, res) {

        database.removeCollection(req.params.cid, function(err) {
            if (!err) {
                res.status(200).end();
            } else {
                res.status(500).send(err);
            }
        });

    });

    // update an existing view.
    app.put('/db/collections/:cid/views/:vid', function(req, res) {

        global.logger.debug('App.put - updating  view: ' + req.params.vid);
        var v, c = getCollection(database, req, res);
        if (!c) {
            return;
        }

        v = getView(database, req, res);
        if (!v) {
            return;
        }


        v.init(req.body._key, req.body._map, req.body._reduce,
            req.body._finalize, req.body._personalize);

        c.updateView(v, function(err) {
            if (err) {
                global.logger.log('error', 'app.put - collections/view: ' + req.params.id + '/' + req.params.vid, err);
                res.status(500).send(err);
            } else {
                res.status(200).send(v.getIdentity());
            }
        });
    });

    /** return the indicated collection */
    app.get('/db/collections/:cid', function(req, res) {
        var c = getCollection(database, req, res);
        if (!c) {
            return;
        }

        res.send(c.toString());
    });

    // remove the documents. Option to delete from disk with 'permanent' parm
    app.delete('/db/collections/:cid/documents', function(req, res) {

        var deleteFromDisk = false,
            c = getCollection(database, req, res);
        if (!c) {
            return;
        }


        if (req.query.permanent === 'true') {
            deleteFromDisk = true;
        }

        c.clear(deleteFromDisk, true, function(err) {
            if (err) {
                res.status(500).send(err);
            } else {
                res.status(204).end();
            }
        });
    });

    /** get a list of views */
    app.get('/db/collections/:cid/views', function(req, res) {

        var list = [],
            c = getCollection(database, req, res);
        if (!c) {
            return;
        }

        Array.from(c.views.values()).forEach(function(item) {
            list.push(item._identity);
        });
        res.send(list);
    });

    /*jslint unparam:true */

    app.get('/db/collections/:id/views/stream', function(req, res) {

        res.status(404).send("Method not yet implemented.");
    });

    /*jslint unparam:false */

    // send back the view
    app.get('/db/collections/:cid/views/:vid', function(req, res) {

        var v = getView(database, req, res);
        if (!v) {
            return;
        }

        res.send(v.toString());
    });

    /**
     * send back the reduction
     *
     */

    app.get('/db/collections/:cid/views/:vid/reduction', function(req, res) {

        var v = getView(database, req, res);
        if (!v) {
            return;
        }
        res.send(JSON.stringify(v.reduction));
    });

    /** remove a view */
    app.delete('/db/collections/:cid/views/:vid', function(req, res) {
        var v, c = getCollection(database, req, res);
        if (!c) {
            return;
        }

        v = getView(database, req, res);
        if (!v) {
            return;
        }

        c.removeView(req.params.vid, function(err) {
            if (err) {
                global.logger.log('error', err);
                res.status(500).send(err);
            } else {
                res.status(200).end();
            }

        });

    });

    // send back a list of subscribers
    app.get('/db/collections/:cid/views/:vid/subscriptions',
        function(req, res) {

            var index, list = [],
                v = getView(database, req, res);
            if (!v) {
                return;
            }

            for (index in v.subscriptions) {
                if (v.subscriptions.hasOwnProperty(index)) {
                    list.push(v.subscriptions[index]._identity);
                }
            }

            res.send(list);
        });

    // some descriptive methods still need to work on
    /*jslint unparam:true */

    app.get('/db/collections/:cid/views/:vid/subscriptions/stream', function(
        req, res) {
        res.status(404).send("Work in progress.");
    });

    /*jslint unparam:false */

    server = require('http').createServer(app);
    database.io = require('socket.io').listen(server, {
        'logger': global.logger
    });

    database.io.on('connection', function(socket) {

        var idlist = [];

        function subscribe(data, volatile) {
            var vidlist = [];
            if (Array.isArray(data)) {
                vidlist = data;
            } else {
                vidlist.push(data);
            }

            vidlist.forEach(function(vid) {

                var myReduction, sub, view = database.viewAt(vid.view);
                if (!view) {
                    global.logger.log('warn', 'Database.subscribe - view [' + vid + '] not found.');
                } else {

                    if (!database.getSettings().useACLTicket || view.checkTicket(vid.ticket)) {
                        // socket.join(vid);

                        sub = {
                            socket: socket,
                            volatile: volatile
                        };

                        // give him an identity and save his headers
                        // note we will use the headers for our
                        // "personalization"
                        // stage in the pipeline
                        sub._identity = new Identity();
                        sub._identity.headers = socket.handshake.headers;
                        sub._identity.delta = vid.delta;

                        // throw this in our hash
                        view.subscriptions[sub._identity._id] = sub;
                        idlist.push({
                            view: view,
                            id: sub._identity._id
                        });
                        global.logger.log('debug', 'Database.socket - subscribe view:' + view._identity._id + ' subscription:' + sub._identity._id);
                        myReduction = view.personalize(sub._identity._id);
                        if (volatile) {
                            socket.volatile.emit(view._identity._id, myReduction);
                        } else {
                            socket.emit(view._identity._id, myReduction);
                        }
                    }
                }
            });
        }

        socket.on('subscribe', function(data) {
            global.logger.log('debug', 'Database.socket -subscribe');
            subscribe(data, false);
        });

        socket.on('subscribev', function(data) {
            global.logger.log('debug', 'Database.socket -subscribev');
            subscribe(data, true);
        });

        socket.on('disconnect', function() {
            idlist.forEach(function(key) {

                global.logger.log('debug', 'Database.socket - disconnect view:' + key.view._identity._id + ' subscription:' + key.id);

                delete key.view.subscriptions[key.id];
            });
        });

        /*jslint unparam: true */
        socket.on('unsubscribe', function(data) {
            // LATER make array aware
            // socket.leave(data.room);
            return undefined;
        });
        /*jslint unparam: false */
    });

    // LATER do we need a different websocket for head listening host???
    if (database.getSettings().hosts) {
        database.getSettings().hosts.forEach(function(host) {
            rtdb.servers.push(server.listen(database.getSettings().port, host));
            global.logger.log('info', 'rtdb (' + database.getIdentity()._pjson.version + ') is listening on ' + host + ':' + database.getSettings().port + ' ...');
        });
    } else {
        rtdb.servers.push(server.listen(database.getSettings().port));
        global.logger.log('info', 'rtdb (' + database.getIdentity()._pjson.version + ') is listening on ' + database.getSettings().port + ' ...');
    }

    global.logger.log('info', database.getIdentity().copyright);
    global.logger.log('info',
        'for more info, visit https://rtdb.rheosoft.com/about/.');

    database.getIdentity().startupTime = new Date().getTime() - startTime;
    done();
}

Rtdb.prototype.stop = function(done) {
    this.servers.forEach(function(server) {
        server.close();
    });
    done();
};
/** main function */
Rtdb.prototype.start = function(done) {
    var database, globalSettings = null,
        settingsFile = null,
        startTime = new Date().getTime(),
        self = this;


    /* we require a settings file */
    if (!argv.help) {
        if (argv.settings) {
            settingsFile = argv.settings;
        } else {
            settingsFile = 'settings/settings.json';
        }
    } else {
        done(new Error('\nrtdb [--settings settingsfile] [--help] [--port portnum] [--host listenhost]'));
        return;
        //process.exit();
    }

    /* load the settings file and setup the logging */
    /*jslint stupid: true */
    if (fs.existsSync(settingsFile)) {
        globalSettings = JSON.parse(fs.readFileSync(settingsFile));
        /*jslint stupid: false */
        // global on purpose
        // we are going to put this in global.
        global.logger = new(winston.Logger)(globalSettings.winston.options);

        globalSettings.winston.transports.forEach(function(item) {
            global.logger.add(winston.transports[item[0]], item[1]);
        });

    } else {
        done(new Error('Settings file not found at - ' + settingsFile));
        return;
    }
    global.logger.log('info', 'Settings loaded from ' + settingsFile + '.');

    if (argv.port) {
        globalSettings.port = argv.port;
    }

    if (argv.host) {
        if (Array.isArray(argv.host)) {
            globalSettings.hosts = argv.host;
        } else {
            globalSettings.hosts = [argv.host];
        }
    }

    if (!globalSettings.port) {
        globalSettings.port = process.env.PORT || process.env.VCAP_APP_PORT || process.env.OPENSHIFT_NODEJS_PORT || 9001;
    }

    if (process.env.OPENSHIFT_NODEJS_PORT) {
        globalSettings.wsport = 8443;
    }

    if (!globalSettings.hosts && (process.env.HOST || process.env.OPENSHIFT_NODEJS_IP)) {
        globalSettings.hosts = [process.env.HOST || process.env.OPENSHIFT_NODEJS_IP];
    }


    // spark it up
    database = new Database(globalSettings, function() {
        loadExpress(self, database, startTime, done);

    });
};

module.exports = Rtdb;
