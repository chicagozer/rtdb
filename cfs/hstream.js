// © 2014 by Rheosoft. All rights reserved. 
// Licensed under the RTDB Software License version 1.0
/*jslint node: true */
"use strict";
var nforce = require('nforce');

function HStream() {
}

var org = nforce.createConnection({
	clientId : process.env.NFORCE_CID,
	clientSecret : process.env.NFORCE_CSECRET,
	redirectUri : "http://localhost:3000/oauth/_callback",
	"environment" : "production"

});

var http = require('http');

var headers = {
	'Content-Type' : 'application/json'
};

var delay = 0;

var options = {
	host : 'localhost',
	port : process.env.PORT || 9001,
	path : '/db/collections/c6e6dda4-e715-4be0-aa36-8ea08a53a3a2/documents',
	method : 'POST',
	headers : headers
};

org.authenticate({
	username : process.env.NFORCE_USER,
	password : process.env.NFORCE_PWD
}, function(err, oauth) {
	if (err) {
		global.logger.log('error', 'HStream.authenticate -  ', err);
		return;
	}

	var str = org.stream({ topic: 'PushTopic3', oauth:oauth});

	str.on('connect', function() {
		global.logger.log('debug',
				'HStream.authenticate - connected to "PushTopic3"');
		// reset the connection delay 
		delay = 0;

	});

	str.on('error', function(error) {
		global.logger.log('error', 'HStream.authenticate -  ', error);
		setTimeout(org.authenticate,delay);
		if (delay === 0)
			delay = 60000;
	});

	str.on('data', function(data) {
		global.logger.log('debug', 'HStream.authenticate - received:', data);

		// Setup the request. The options parameter is
		// the object we defined above.
		var req = http.request(options, function(res) {

			
			res.setEncoding('utf-8');
			res.on('end', function() {
				global.logger.log('debug', 'HStream.authenticate - posted');
			});
			
			res.on('data', function(data) {
			});

			res.on('error', function(err) {
				global.logger.log('error', 'HStream.authenticate - posting:',err);
			});
			
		});

		req.on('error', function(e) {
			global.logger.log('error', 'HStream.post -  ', e);
		});

		req.write(JSON.stringify(data.sobject));
		req.end();

	});

});

module.exports = HStream;


