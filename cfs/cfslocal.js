// © 2014 by Rheosoft. All rights reserved. 
// Licensed under the RTDB Software License version 1.0

// local file system support
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
function CFSL() {
}

CFSL.prototype.init = function(parms) {
	this.root = parms.root;
};

CFSL.prototype.name = function()
{
	return 'CFSL';
};

CFSL.prototype.get = function(key, callback) {
	logger.log('silly', 'CFSL.get - ', key);
	fs.readFile(this.root + key, function(err, data) {
		if (err) {
			logger.log('error', 'CFSL.get', err);
			callback(err);
		} else {
			callback(null, JSON.parse(data));
		}
	});
};

CFSL.prototype.exists = function(dir, callback) {
	fs.exists(this.root + dir,callback);
};


CFSL.prototype.del = function(fn, callback) {
	var key = this.root + fn;
	fs.unlink(key,callback);
};

CFSL.prototype.put = function(prefix, item, callback) {
	var fn = this.root;

	var key;
	// FIXME need to fix this misalignment somehow :((
	if (item._identity)
		key = fn + prefix + item._identity._id + '.json';
	else if (item._id)
		key = fn + prefix + item._id + '.json';
	else {
		callback('No _id found in item.');
		return;
	}

	var dirname = path.dirname(key);
	mkdirp(dirname, function(err) {
		if (err)
			callback(err);
		else {
			logger.log('debug', 'CFSL.put - ', key);
			fs.writeFile(key, JSON.stringify(item), callback);
		}
	});
};

CFSL.prototype.list = function(prefix, callback) {
	
	var dir  = this.root + prefix ;
	mkdirp(dir, function(err) {
		if (err)
			callback(err);
		else {
			fs.readdir(dir, function(err, data) {
				if (err)
					callback(err);
				else {
					var list = [];
					data.forEach(function(item) {
				// BUG! we were picking up .DS_DStore stuff
						if (item.match('\\.json$'))
							list.push(prefix + item);
					});
					callback(null, list);
				}
			});
		}
	});	
};

module.exports = CFSL;
