// © 2014 by Rheosoft. All rights reserved. 
// Licensed under the RTDB Software License version 1.0
"use strict";
var express = require('express');
var auth = require('http-auth');
var errorHandler = require('errorhandler');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var Database = require('./db');
var Collection = require('./collection');
var View = require('./view');
var Identity = require('./identity');
var argv = require('optimist').argv;
var pjson = require('./package.json');
var fs = require('fs');
var winston = require('winston');
var http = require('http');
var Symmetry = require('symmetry');
// var io = require('socket.io');
// var markdown = require( "markdown" ).markdown;
// var md = require("node-markdown").Markdown;

// helper function to add a stream. We call it from a couple places
function addStream(req, res, view, delta) {
	// save a reference to our subscriber
	var sub = {
		res : res
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
		logger.log('info', 'drain - subscription:', sub._identity._id);
		if (sub.data) {

			var data;
			if (sub._identity.delta) {
				data = Symmetry.diff(sub.last, sub.data);

			} else
				data = sub.data;

			sub.last = sub.data;

			res.write('event: ');
			res.write(view._identity._id + '\n');
			res.write("data: ");
			sub.overflow = !res.write(JSON.stringify(data) + '\n\n');
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
	var myReduction = view.personalize(sub._identity._id);
	var data = JSON.stringify(myReduction);
	if (sub._identity.delta)
		sub.last = myReduction;

	// NOTE we need to break this up or express escape encodes
	// it. must
	// think it's a header!
	res.write('event: ');
	res.write(view._identity._id + '\n');
	res.write("data: ");
	sub.overflow = !res.write(data + '\n\n');

}



/** loadExpress methods */
function loadExpress(database, start) {

	logger.log('debug', 'Database.loadExpress - started.');
	var app = express();

	// lets cap the # of sockets at a reasonable # so we don't run out of
	// filehandles
	if (database.globalSettings.maxSockets) {
		logger.log('debug', 'Database.loadExpress - maxSockets:',
					database.globalSettings.maxSockets);
		http.globalAgent.maxSockets = database.globalSettings.maxSockets;
	}
	// if you want to handle POSTS, you need this
	// add all the plugins
	app.use(bodyParser());
	app.use(methodOverride());
	app.use(cookieParser("yabadabachangeme"));

	// serve up statics if we aren't running under another web server
	// I think this is clever
	app.use(express.static(__dirname + '/public'));
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');

	var env = process.env.NODE_ENV || 'development';
	if ('development' == env ) {
		app.use(errorHandler());
		app.locals.pretty = true;
	}

	// since most browsers can't handle alot of SSEs we allow the
	// requester to come in with a bunch of views to see

		function startsWith(str, start, i) {
		return str.substr(i || 0, start.length) === start;
	}
		
    
		
	var basic = auth.basic({
	        realm: "rtdb"
	    }, function (username, password, callback) { // Custom authentication method.
	    	var reply;
	    	
	    	if (database.getSettings().disableBasicAuth)
	    		reply = true;
			
			reply =  username === (process.env.RTDBADMIN_USER || 'admin')
				&& password === (process.env.RTDBADMIN_PWD || 'chang3m3');
			callback(reply);
			}
	);	
	
	app.all('/web/*', auth.connect(basic));
	app.all('/db/admin/*', auth.connect(basic));
	

	app.get('/db/stream', function(req, res) {

		var vlist = [];
		var verrlist = [];
		var vidlist = [];
		var ticketlist = [];
		var delta = false;
		// pull out the list of views
		// maybe it's an array or just a single
		if (Array.isArray(req.query.view))
			{
			vidlist = req.query.view;
			ticketlist = req.query.ticket;
			}
		else
			{
			vidlist.push(req.query.view);
			ticketlist.push(req.query.ticket);
			}

		if (req.query.delta === 'true')
			delta = true;

		// for each view id, go find the actual view
		vidlist.forEach(function(vid) {
			var view = database.viewAt(vid);
			if (!view) {
				logger.log('warn', 'Database.stream - view [' + vid
						+ '] not found.');
				verrlist.push(vid);
			} else
				vlist.push(view);
		});

		// if we didn't come back with the same # of views was requested
		// bail out with a not found.
		if (vlist.length != vidlist.length) {
			res.send(404, { Status: 404, Message: "Some views not found:" + verrlist});
			return;
		}

		if (database.getSettings().useACLTicket != false) {
		
			var fail = false;
			
			
			if (ticketlist.length != vlist.length)
				{
				res.send(403, { Status: 403, Message: "You must supply a ticket for each view."});
				return;
				}
			
			var errticket = [];
			
			vlist.forEach(function(view,index){
				if (!view.checkTicket(ticketlist[index]))
					{
					fail = true;
					}
			});
			if (fail)
				{
				res.send(403, { Status: 403, Message: "Invalid ticket(s):" + errticket});
				return;
				}
			}
		logger.log('debug', 'app.get stream: writing stream!!');
		// setup the SEE
		if (res.setTimeout)
			res.setTimeout(0);
		res.writeHead(200, {
			"Content-Type" : "text/event-stream",
			"Cache-Control" : "no-cache",
			"Connection" : "keep-alive"
		});

		// TODO maybe make this a setting
		res.write("retry: 1000\n");

		// for each view in our list
		vlist.forEach(function(v) {
			addStream(req, res, v, delta);
		});
	});

	// write the headers; diagnostic function
	app.get('/db/admin/echo',  function(req, res) {
		res.send(req.headers);
	});

	// quick little function that will shutdown the DB
	app.post('/db/admin/stop',  function(req, res) {
		database.saveViewsThenExit();
		res.send(202);
	});

	// method to reload the documents
	// useful if we are messing with the disk
	app.post('/db/collections/:id/load', function(req, res) {
		var c = database.collectionAt(req.params.id);
		if (!c) {
			res.send(404, { Status: 404, Message: "collection " + req.params.id + " is not in the database."});
			return;
		}
		// reset the collection
		c.clear(false, false, function(err) {
			if (err) {
				res.send(500, { Status: 500, Message: err});
				return;
			}
			c.loadDocuments(c.views, function(err) {
				if (!err)
					res.send(200);
				else
					res.send(500, { Status: 500, Message: err});
			});
		});
	});

	// add a document or array of documents
	app.post('/db/collections/:id/documents', function(req, res) {

		var c = database.collectionAt(req.params.id);
		if (!c) {
			res.send(404, { Status: 404, Message: "collection " + req.params.id + " is not in the database."});
			return;
		}

		var docs = [];
		if (!Array.isArray(req.body))
			docs.push(req.body);
		else
			docs = req.body;

		c.put(docs, function(err) {
			if (!err)
				res.send(201);
			else
				res.send(500, { Status: 500, Message: err});
		});
	});

	// serve up some stats
	app.get("/db/admin/stats",  function(req, res) {

		// get current memory and uptime
		// FIXME - so hacky
		database.getIdentity().hosts = database.globalSettings.hosts;
		database.getIdentity().port = database.globalSettings.port;
		database.getIdentity().memory = process.memoryUsage();
		database.getIdentity().uptime = process.uptime();
		database.getIdentity().dirname = __dirname;
		res.send(database.getIdentity());

	});

	// this is the standard way to get to a stream
	app.get('/db/collections/:cid/views/:vid/stream', function(req, res) {

		var c = database.collectionAt(req.params.cid);
		if (!c) {
			res.send(404, { Status: 404, Message: "collection " + req.params.cid + " is not in the database."});
			return;
		}

		var view = c.viewAt(req.params.vid);

		if (!view) {
			res.send(404, { Status: 404, Message: "view " + req.params.vid + " is not in the collection."});
			return;
		}

		res.setTimeout(0);
		// setup the SEE
		res.writeHead(200, {
			"Content-Type" : "text/event-stream",
			"Cache-Control" : "no-cache",
			"Connection" : "keep-alive"
		});

		// TODO maybe make this a setting
		res.write("retry: 1000\n");

		// add the stream
		addStream(req, res, view);
	});

	app.get('/about', function(req, res) {
		res.render('about');
	});

	app.get('/help/:id', function(req, res) {
		res.render('help/' + req.params.id);
	});

	app.get('/index', function(req, res) {
		res.render('index', {
			json : database._identity
		});
	});

	app.get('/demo/:dpage', function(req, res) {
		res.render(req.params.dpage, {
			json : database._identity
		});
	});

	// home page
	app.get("/", function(req, res) {
		res.render('home', {
			json : database._identity
		});
	});

	// main web page
	app.get("/web",  function(req, res) {
		res.render('main', {
			json : database._identity
		});
	});

	// not exactly sure why I have this, but force a reduce
	app.get('/db/collections/:cid/views/:vid/stats', function(req, res) {

		var c = database.collectionAt(req.params.cid);
		if (!c) {
			res.send(404, { Status: 404, Message: "collection " + req.params.cid + " is not in the database."});
			return;
		}
		var view = c.viewAt(req.params.vid);
		if (!view) {
			res.send(404, { Status: 404, Message: "view " + req.params.vid + " is not in the collection."});
			return;
		}

		res.send(view.stats);
	});
	
	// not exactly sure why I have this, but force a reduce
	app.get('/db/collections/:cid/views/:vid/ticket', function(req, res) {

		var c = database.collectionAt(req.params.cid);
		if (!c) {
			res.send(404, { Status: 404, Message: "collection " + req.params.cid + " is not in the database."});
			return;
		}
		var view = c.viewAt(req.params.vid);
		if (!view) {
			res.send(404, { Status: 404, Message: "view " + req.params.vid + " is not in the collection."});
			return;
		}

		res.send( JSON.stringify({ ticket : view.issueTicket() }));
	});

	/** collection stats */
	app.get('/db/collections/:cid/stats', function(req, res) {

		var c = database.collectionAt(req.params.cid);
		if (!c) {
			res.send(404, { Status: 404, Message: "collection " + req.params.cid + " is not in the database."});
			return;
		}
		res.send(c.stats);
	});

	app.get('/demo/:dpage', function(req, res) {
		res.render(req.params.dpage);
	});

	/** templated db stats */
	app.get("/web/admin/stats",  function(req, res) {

		// get current memory and uptime
		database.getIdentity().hosts = database.globalSettings.hosts;
		database.getIdentity().port = database.globalSettings.port;
		database.getIdentity().memory = process.memoryUsage();
		database.getIdentity().uptime = process.uptime();
		database.getIdentity().dirname = __dirname;
		res.render('stats', {
			json : database.getIdentity()
		});

	});

	/** templated list of collections */

	app.get('/web/collections',  function(req, res) {
		var list = [];
		database.collections.forEach(function(item) {
			list.push(item.getIdentity());
		});

		res.render('collections', {
			json : list
		});

	});

	/** templated collection */

	app.get('/web/collections/:id',  function(req, res) {
		logger.debug('app.get /web/collections id is ' + req.params.id);
		var c = database.collectionAt(req.params.id);
		if (!c)
			res.send(404, { Status: 404, Message: "collection " + req.params.id + " is not in the database."});
		else
			res.render('collection', {
				json : c._identity
			});
	});

	/** templated list of views */

	app.get('/web/collections/:id/views',  function(req, res) {
		var list = [];
		var c = database.collectionAt(req.params.id);
		if (!c) {
			res.send(404, { Status: 404, Message: "collection " + req.params.id + " is not in the database."});;
			return;
		}
		c.views.forEach(function(item) {
			list.push(item._identity);
		});
		res.render('views', {
			json : list,
			cid : c._identity._id
		});
	});

	// templated view
	app.get('/web/collections/:cid/views/:vid',  function(req, res) {
		var c = database.collectionAt(req.params.cid);
		if (!c) {
			res.send(404, { Status: 404, Message: "collection " + req.params.cid + " is not in the database."});
			return;
		}
		var view = c.viewAt(req.params.vid);
		if (view)
			res.render('view', {
				json : view._identity,
				cid : req.params.cid
			});
		else
			res.send(404, { Status: 404, Message: "view " + req.params.vid + " is not in the collection."});
	});

	// templated reduction
	app.get('/web/collections/:cid/views/:vid/reduction',  function(req,
			res) {
		var c = database.collectionAt(req.params.cid);
		if (!c) {
			res.send(404, { Status: 404, Message: "collection " + req.params.cid + " is not in the database."});
			return;
		}
		var view = c.viewAt(req.params.vid);
		if (!view) {
			res.send(404, { Status: 404, Message: "view " + req.params.vid + " is not in the collection."});
			return;
		}

		res.render('reduction', {
			json : view.reduction,
			cid : req.params.cid,
			vid : req.params.vid,
			rid : view._redcontainer._identity._id
		});
	});

	// return templated list of subscriptions
	app.get('/web/collections/:cid/views/:vid/subscriptions',  function(
			req, res) {
		var c = database.collectionAt(req.params.cid);
		if (!c) {
			res.send(404, { Status: 404, Message: "collection " + req.params.cid + " is not in the database."});
			return;
		}
		var view = c.viewAt(req.params.vid);
		if (!view) {
			res.send(404, { Status: 404, Message: "view " + req.params.vid + " is not in the collection."});
			return;
		}
		var list = [];
		for ( var index in view.subscriptions) {
			list.push(view.subscriptions[index]._identity);
		}
		res.render('subscriptions', {
			json : list,
			cid : req.params.cid,
			vid : req.params.vid
		});
	});

	// get a list of collections
	app.get('/db/collections', function(req, res) {

		var list = [];
		database.collections.forEach(function(item) {
			list.push(item._identity);
		});
		res.send(list);
	});

	app.get('/db/collections/stream', function(req, res) {

		// TODO STREAM changes to the collections
		res.send(404, { Status: 404, Message: "Method not yet implemented."});
	});

	app.get('/db/collections/stream/new', function(req, res) {

		// TODO STREAM new collections
		res.send(404, { Status: 404, Message: "Method not yet implemented."});
	});

	app.get('/db/collections/:id/documents/stream', function(req, res) {

		// TODO STREAM documents
		res.send(404, { Status: 404, Message: "Method not yet implemented."});
	});

	app.get('/db/collections/:id/documents/stream/new', function(req, res) {

		// TODO STREAM documents
		res.send(404, { Status: 404, Message: "Method not yet implemented."});
	});

	// add collection

	app.post('/db/collections', function(req, res) {

		var c;
		if (req.body._id)
			c = new Collection(database, req.body);
		else
			c = new Collection(database).init();

		database.addCollection(c, function(err) {
			if (err) {
				logger.log('error', 'app.post - collections', err);
				res.send(500, { Status: 500, Message: err});
			} else
				res.send(201, c._identity);
		});
	});

	// add a view

	app.post('/db/collections/:id/views', function(req, res) {

		logger.debug('App.post - adding view to ' + req.params.id);
		var c = database.collectionAt(req.params.id);
		if (!c) {
			var msg = 'app.post - collections/views ' + req.params.id
					+ ' not found.';
			logger.log('error', msg);
			res.send(404, { Status: 404, Message: "collection " + req.params.id + " is not in the database."});
		}

		var v;

		if (req.body._id) {
			v = new View(database, c, req.body);

		} else {
			v = new View(database, c).init();
		}
		c.addView(v, function(err) {
			if (err) {
				logger.log('error', 'app.post - collections/view: '
						+ req.params.id + '/' + req.params.vid, err);
				res.send(500, { Status: 500, Message: err});
			} else {
				res.send(201, v.getIdentity());
			}
		});
	});

	// update an existing collection
	app.put('/db/collections/:id', function(req, res) {

		var c = database.collectionAt(req.params.id);
		if (!c) {
			res.send(404, { Status: 404, Message: "collection " + req.params.id + " is not in the database."});
			return;
		}
		c.init(req.body._key, req.body._transient, req.body._priority,
				req.body._expiration, req.body._onAdd);
		database.updateCollection(c, function(err) {
			if (err)
				res.send(500, { Status: 500, Message: err});
			else
				res.send(200);
		});
	});

	// remove an existing collection
	app.delete('/db/collections/:id', function(req, res) {

		database.removeCollection(req.params.id, function(err) {
			if (!err)
				res.send(200);
			else
				res.send(500, { Status: 500, Message: err});
		});

	});

	// update an existing view.
	app.put('/db/collections/:id/views/:vid', function(req, res) {

		logger.debug('App.put - updating  view: ' + req.params.vid);
		var c = database.collectionAt(req.params.id);
		if (!c) {
			res.send(404, { Status: 404, Message: "collection " + req.params.id + " is not in the database."});
			return;
		}
		var v = c.viewAt(req.params.vid);
		if (!v) {
			res.send(404, { Status: 404, Message: "view " + req.params.vid + " is not in the collection."});
			return;
		}
		v.init(req.body._key, req.body._map, req.body._reduce,
				req.body._finalize, req.body._personalize);

		c.updateView(v, function(err) {
			if (err) {
				logger.log('error', 'app.put - collections/view: '
						+ req.params.id + '/' + req.params.vid, err);
				res.send(500, { Status: 500, Message: err});
			} else
				res.send(200, v.getIdentity());
		});
	});

	/** return the indicated collection */
	app.get('/db/collections/:id', function(req, res) {
		var c = database.collectionAt(req.params.id);
		if (!c) {
			res.send(404, { Status: 404, Message: "collection " + req.params.id + " is not in the database."});
			return;
		}
		res.send(c.toString());
	});

	// remove the documents. Option to delete from disk with 'permanent' parm
	app.delete('/db/collections/:id/documents', function(req, res) {

		var c = database.collectionAt(req.params.id);
		if (!c) {
			res.send(404, { Status: 404, Message: "collection " + req.params.id + " is not in the database."});
			return;
		}

		var deleteFromDisk = false;
		if (req.query.permanent === 'true')
			deleteFromDisk = true;

		c.clear(deleteFromDisk, true, function(err) {
			if (err)
				res.send(500, { Status: 500, Message: err});
			else
				res.send(204);
		});
	});

	/** get a list of views */
	app.get('/db/collections/:id/views', function(req, res) {

		var list = [];

		var c = database.collectionAt(req.params.id);
		if (!c) {
			res.send(404, { Status: 404, Message: "collection " + req.params.id + " is not in the database."});
			return;
		}
		c.views.forEach(function(item) {
			list.push(item._identity);
		});
		res.send(list);
	});

	app.get('/db/collections/:id/views/stream', function(req, res) {

		res.send(404, { Status: 404, Message: "Method not yet implemented."});
	});

	app.get('/db/collections/:id/views/stream/new', function(req, res) {

		res.send(404, { Status: 404, Message: "Method not yet implemented."});
	});

	// send back the view
	app.get('/db/collections/:cid/views/:vid', function(req, res) {

		var c = database.collectionAt(req.params.cid);
		if (!c) {
			res.send(404, { Status: 404, Message: "collection " + req.params.cid + " is not in the database."});
			return;
		}
		var view = c.viewAt(req.params.vid);
		if (!view) {
			res.send(404, { Status: 404, Message: "view " + req.params.vid + " is not in the collection."});
			return;
		}

		res.send(view.toString());
	});

	/**
	 * send back the reduction
	 *
	 */

	app.get('/db/collections/:cid/views/:vid/reduction', function(req, res) {

		var c = database.collectionAt(req.params.cid);
		if (!c) {
			res.send(404, { Status: 404, Message: "collection " + req.params.cid + " is not in the database."});
			return;
		}
		var view = c.viewAt(req.params.vid);
		if (!view) {
			res.send(404, { Status: 404, Message: "view " + req.params.vid + " is not in the collection."});
			return;
		}
		res.send(JSON.stringify(view.reduction));
	});

	/** remove a view */
	app.delete('/db/collections/:cid/views/:vid', function(req, res) {
		var c = database.collectionAt(req.params.cid);
		if (c) {

			var view = c.viewAt(req.params.vid);
			if (!view) {
				res.send(404, { Status: 404, Message: "view " + req.params.vid + " is not in the collection."});
				return;
			}

			c.removeView(req.params.vid, function(err) {
				if (err) {
					logger.log('error', err);
					res.send(500, { Status: 500, Message: err});
				} else {
					res.send(200);
				}

			});
		} else {
			var msg = 'app.del - Collection ' + req.params.cid + ' not found.';
			logger.log('warn', msg);
			res.send(404, { Status: 404, Message: "collection " + req.params.cid + " is not in the database."});
		}
	});

	// send back a list of subscribers
	app.get('/db/collections/:cid/views/:vid/subscriptions',
			function(req, res) {

				var c = database.collectionAt(req.params.cid);
				if (!c) {
					res.send(404, { Status: 404, Message: "collection " + req.params.cid + " is not in the database."});
					return;
				}
				var view = c.viewAt(req.params.vid);
				if (!view) {
					res.send(404, { Status: 404, Message: "view " + req.params.vid + " is not in the collection."});
					return;
				}
				var list = [];
				for ( var index in view.subscriptions) {
					list.push(view.subscriptions[index]._identity);
				}

				res.send(list);
			});

	// some descriptive methods still need to work on

	app.get('/db/collections/:cid/views/:vid/subscriptions/stream', function(
			req, res) {
		res.send(404, "Work in progress.");
	});

	app.get('/db/collections/:cid/views/:vid/subscriptions/stream/new',
			function(req, res) {
				res.send(404, "Work in progress.");
			});

	var server = require('http').createServer(app);
	database.io = require('socket.io').listen(server, {
		'logger' : logger
	});

	database.io.on('connection', function(socket) {
		
		//console.log(socket.handshake.headers);
			  
		// Server Side
		var idlist=[];

		socket.on('subscribe', function(data) {

			var vidlist=[];
			if (Array.isArray(data))
				vidlist = data;
			else
				vidlist.push(data);

			vidlist.forEach(function(vid) {
				
				var view = database.viewAt(vid.view);
				if (!view) {
					logger.log('warn', 'Database.subscribe - view [' + vid
							+ '] not found.');
				} else {
					
					if (!database.getSettings().useACLTicket || view.checkTicket(vid.ticket))
						{
						//socket.join(vid);
					
						var sub = {
								socket : socket
						};

						// give him an identity and save his headers
						// note we will use the headers for our "personalization"
						// stage in the pipeline
						sub._identity = new Identity();
						sub._identity.headers = socket.handshake.headers;
						sub._identity.delta = data.delta;

						// throw this in our hash
						view.subscriptions[sub._identity._id] = sub;
						idlist.push( 
								{
									view : view,
									id : sub._identity._id
								});
						logger.log('debug', 'Database.socket - subscribe view:'  + view._identity._id + ' subscription:' + sub._identity._id);
						var myReduction = view.personalize(sub._identity._id);
						socket.volatile.emit(vid, myReduction);
						}
				}
			});
		});

		socket.on('disconnect', function()
			{
			idlist.forEach(function(key)
					{
				
					logger.log('debug', 'Database.socket - disconnect view:'  + key.view._identity._id + ' subscription:' + key.id);
				
					delete key.view.subscriptions[key.id];
					});
			});
		
		socket.on('unsubscribe', function(data) {
			// TODO make array aware
			//socket.leave(data.room);
		});
	});

	// TODO do we need a different websocket for head listening host???
	if (database.getSettings().hosts) {
		database.getSettings().hosts.forEach(function(host) {
			server.listen(database.getSettings().port, host);
			logger.log('info', 'rtdb (' + database.getIdentity()._pjson.version
					+ ') is listening on ' + host + ':'
					+ database.getSettings().port + ' ...');
		});
	} else {
		server.listen(database.getSettings().port);
		logger.log('info', 'rtdb (' + database.getIdentity()._pjson.version
				+ ') is listening on ' + database.getSettings().port + ' ...');
	}

	logger.log('info', database.getIdentity().copyright);
	logger
			.log('info',
					'for more info, visit https://rtdb.rheosoft.com/about/.');

	database.getIdentity().startupTime = new Date().getTime() - start;
}

/** main function */
function main() {
	var start = new Date().getTime();
	var settingsFile = null;

	/* we require a settings file */
	if (!argv.help) {
		if (argv.settings)
			settingsFile = argv.settings;
		else
			settingsFile = 'settings/settings.json';
	} else {
		console
				.log('\nrtdb [--settings settingsfile] [--help] [--port portnum] [--host listenhost]');
		process.exit();
	}

	var globalSettings = null;

	/* load the settings file and setup the logging */
	if (fs.existsSync(settingsFile)) {
		globalSettings = JSON.parse(fs.readFileSync(settingsFile));
		// global on purpose
		// we are going to put this in global.
		global.logger = new (winston.Logger)(globalSettings.winston.options);

		globalSettings.winston.transports.forEach(function(item) {
			logger.add(winston.transports[item[0]], item[1]);
		});

	} else {
		console.error('Settings file not found at - ' + settingsFile);
		console.error('Sorry, but we have to leave.');
		process.exit();
	}
	logger.log('info', 'Settings loaded from ' + settingsFile + '.');

	if (argv.port)
		globalSettings.port = argv.port;

	if (argv.host) {
		if (Array.isArray(argv.host))
			globalSettings.hosts = argv.host;
		else
			globalSettings.hosts = [ argv.host ];
	}

	if (!globalSettings.port)
		globalSettings.port = process.env.PORT || process.env.VCAP_APP_PORT || process.env.OPENSHIFT_NODEJS_PORT
				|| 9001;

	if (!globalSettings.hosts && (process.env.HOST || process.env.OPENSHIFT_NODEJS_IP))
		globalSettings.hosts = [ process.env.HOST || process.env.OPENSHIFT_NODEJS_IP];

	// spark it up
	var database = new Database(globalSettings, function() {
		loadExpress(database, start);

	});
}

main();
