// © 2014 by Rheosoft. All rights reserved. 
// Licensed under the RTDB Software License version 1.0

var http = require('http');
var fs = require('fs');
var async = require('async');

function Parcel() {
}

var dir = 'sampledb/parcels/';
var data = {};


var headers = {
	'Content-Type' : 'application/json'
};

 poptions = {
	host : 'localhost',
	port : process.env.PORT || 9001,
	path : '/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/documents',
	method : 'POST',
	headers : headers
};
 
 foptions = {
			host : 'localhost',
			port : process.env.PORT || 9001,
			path : '/db/collections/e08e31fa-f414-4f2f-b067-6bce67fae7b0/documents?permanent=true',
			method : 'DELETE',
			headers : headers
		};

// Setup the request. The options parameter is
// the object we defined above.
var count = 0;

function readFile(file, callback) {
	
	var start = new Date();
	
	fs.readFile(dir + file, 'utf-8', function(err, data) {
		if (err)
			callback(err);

		poptions.headers['Content-Length'] = data.length;

		var req = http.request(poptions, function(res) {

			res.setEncoding('utf-8');
			res.on('end', function() {
				var now = new Date();
				// we are going to slow this down to a max of 100 inserts per sec
				var delay = Math.max(0, 10 - (now - start));
				setTimeout(callback, delay);
			});
			
			res.on('data', function(data) {
			});

			res.on('error', function(err) {
				callback(err);
			});
		});

		req.on('error', function(e) {
			callback(err);
		});
		
		if (logger.level === 'silly')
			logger.log('silly', 'HStream.readFile - writing ' + count++);

		req.write(data);
		req.end();

	});

}

setTimeout(main, 10000);


function main() {
	fs.readdir(dir, function(err, files) {
		if (err)
			throw err;

		async.eachSeries(files, readFile, function(err) {
			if (err)
				logger.log('error', 'HStream.readFile - ',err);
			else
				logger.log('debug', 'HStream.readFile - done');
			setTimeout(main,0);
			setInterval(http.request(poptions), 1000*60*5);
		});

	});
}

module.exports = Parcel;
