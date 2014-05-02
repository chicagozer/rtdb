// © 2014 by Rheosoft. All rights reserved. 
// Licensed under the RTDB Software License version 1.0
var events = require('events');
var Identity = require('./identity');
var async = require('async');
var View = require('./view');
var vm = require('vm');


// todo move to settings perhaps
// this controls concurrency when dealing with files
var eachLimit = 10;

function Collection(database, obj) {

	if (null !== obj && "object" == typeof obj)
		{
		this._identity = obj;
		if (this._identity._onAdd)
			this._fonAdd = new Function("item", "database", this._identity._onAdd);
		}
	else
		this._identity = new Identity();

	this._emitter = new events.EventEmitter();

	this.database = database;
	//this.documents = [];
	this.views = [];
	this._viewsHash = {};

	this._workingdocs = [];
	this.stats = { fileCount: 0};

	var self = this;
	var lastReduce=null;
	var lastExpire=null;

	function dateDiff(date1, date2) {
		return date1.getTime() - date2.getTime();
	}
	
	function doExpire() {

		logger.log('debug','expiring ' + self._identity._id);
		// calculate when was the last expire. if less than 1 sec (now configurable), hold off.
		var now = new Date();
		var delay = 0;
		
		if (lastExpire) {
			var delta = dateDiff(now, lastExpire);

			var interval = 1000 * 60;
			if (self.database.globalSettings.expireInterval)
				interval = self.database.globalSettings.expireInterval;

			delay = Math.max(0, interval - delta);
		}
		lastExpire = now;

		setTimeout(function() {
			self._workingdocs.length = 0;
			//self.documents.length = 0;
			self.views.forEach(function (v) { v.reset();});
			// console.log('### working docs is ' +self.workingdocs.length);
			self.loadDocuments(self.views, function(err) {
				if (err)
					logger.log('error', err);
				self._emitter.once('expire', doExpire);
			});
		}, delay);
	}

	function doReduce() {

		logger.log('debug', 'in reduce! ', self._identity._id);
		// calculate when was the last reduce. if less than 1 sec (now
		// configurable), hold off.
		var now = new Date();
		var delay = 0;
		if (lastReduce) {
			var delta = dateDiff(now, lastReduce);

			var interval = 1000;
			if (self.database.globalSettings.reduceInterval)
				interval = self.database.globalSettings.reduceInterval;
			delay = Math.max(0, interval - delta);
		}

		lastReduce = now;
		logger.log('debug','reduce delay is ',delay);

		setTimeout(function() {
			logger.log('debug', 'Reducing ', self._identity._id);
			// console.log('### working docs is ' +self.workingdocs.length);
			self.views.forEach(function(elem) {
				try {
					elem.mapreduce(self._workingdocs, true);
				} catch (e) {
					logger.log('error', e.toString());
				}
			});
			self._workingdocs.length = 0;
			self._emitter.once('change', doReduce);
		}, delay);
	}

	// THIS is the secret sauce...we are registering our listener for reduce
	// requests!
	self._emitter.once('change', doReduce);
	self._emitter.once('expire', doExpire);
	
	
	return this;
}

Collection.prototype.init = function(key, trans, priority, expiration, onAdd) {
	if (!this._identity)
		this._identity = new Identity();
	this._identity._key = key;
	this._identity._transient = trans;
	this._identity._priority = priority;
	this._identity._expiration = expiration;
	
	if (onAdd)
		{
		this._identity._onAdd = onAdd;
		this._fonAdd = new Function("item", "database", onAdd);
		}
	else
		{
		if (this._identity._onAdd)
			delete this._identity._onAdd;
		if (this._fonAdd)
			delete this._fonAdd;
		}
	// FIXME - do I need to setup an expiration??
	return this;
};

Collection.prototype.push = function() {

	var self = this;
	var docs = Array.prototype.slice.call(arguments, 0);

	if (docs.length === 0)
		return;

	// if (logger.level === 'debug')logger.log('debug',docs);
	var retval = docs;
	
	if (self._fonAdd)
		{	// ok so we are going to implement a trigger
		docs.forEach(function(e) {
			self._fonAdd(e, self.database);
			});
		}
	
	if (this._identity._transient !== true) {
		//retval = this.documents.push.apply(this.documents, arguments);

		// if this collection has an expiration, set up a timer to expire the
		// docs
		if (self._identity._expiration) {

			setTimeout(function() {
				// console.log('### working docs is ' +self.workingdocs.length);
				self._emitter.emit('expire');
			}, self._identity._expiration);

		}
	}

	if (this.views.length > 0) {
		docs.forEach(function(item) {
			self._workingdocs.push(item);
		});
		// signal for reduce.
		logger.log('debug', 'emitting change for ', self._identity._id);

		self._emitter.emit('change');
	}
	return retval;

};


Collection.prototype.loadDocuments = function(viewlist, callback) {

	var dir = 'collection/' + this._identity._id + '/documents/';

	var self = this;
	logger.log('debug',
				'Collection.loadDocuments: loading documents from ', dir);
	// console.trace(callback);
	//self.documents.length = 0;
	self._workingdocs.length = 0;

	function readIt(item, callback) {
		self.database.cfs.get(item, function(err, data) {
			if (err) {
				logger.log('error', err);
				callback(err);
				return;
			} else {
				if (self._identity._transient !== true)
					self._workingdocs.push(data);

				// THIS IS OVERRIDEN
				// self.push(data);
			}
			callback();
		});
	}

	function innerLoop(idx, files, callback) {

		// do we have anything to reduce?
		if (idx >= files.length) {
			callback();
			return;
		}
		var notify = idx + 100 >= files.length;
		logger.log('debug', 'Collection.loadDocuments.innerLoop idx:' + idx
				+ ' doc count is ' + self._workingdocs.length);
		

		var subset = files.slice(idx, idx + 100);

		// we need to use the async library to do 100 at a time.
		logger.log('debug',
				'Collection.loadDocuments.innerLoop calling asynceach');
		async.eachLimit(subset, eachLimit, readIt, function(err) {
			if (err)
				{
				callback(err);
				return;
				}
			else
				{
				
				logger.log('debug',
						'Collection.loadDocuments.innerLoop idx: files.length is '
								+ files.length + ' notify is ' + notify);
				if (self._workingdocs.length > 0) {
					viewlist.forEach(function(v) {
						logger.log('debug',
								'Collection.loadDocuments.innerLoop reducing :'
										+ v.getId());
						try
							{
							if (v._identity._exception)
								delete v._identity._exception;
							v.mapreduce(self._workingdocs, notify);
							}
						catch (e)
						{
							logger.log('error',e.toString());
							v._identity._exception = e.toString();
						}
					});
					// reset to zero
					self._workingdocs.length = 0;
				}
				
				
				innerLoop(idx + 100, files, callback);
				}
		});
	}

	self.database.cfs.exists(dir, function(exists) {

		if (exists) {
			self.database.cfs.list(dir, function(err, files) {
				if (err) {
					logger.log('error', 'Collection.loadDocuments ['
							+ self._identity._id + ']', err);
					callback(err);
					return;
				} else {
					var count = files.length;
					self.stats.fileCount = count;
					logger.log('debug', 'Collection.loadDocuments: ['
								+ self._identity._id + '] document count is ',
								count);

					innerLoop(0, files, callback);
				}
			});
		} else {
			logger.log('warn', 'Collection.loadDocuments ['
					+ self._identity._id + '] ' + dir + ' does not exist.');
			callback();
		}
	});
};

Collection.prototype.loadViews = function(callback) {

	var dir = 'collection/' + this._identity._id;
	var self = this;
	var vdir = dir + '/views/';
	
	logger.log('debug', 'Collection.loadViews', vdir);
	self.database.cfs.exists(vdir, function(exists) {
		if (exists) {
			logger.log('debug', 'Collection.loadViews listing ', vdir);
			self.database.cfs.list(	vdir,function(err, files) {
				if (err) {
					logger.log('error', 'Collection.loadViews ['+ self._identity._id + ']', err);
					callback();
					return;
					} 
				else {
					var count = files.length;
		
					if (count === 0) {
						callback();
						return;
						}
		
					async.eachLimit(files,eachLimit, function(item, callback) {
						logger.log('debug','Collection.loadViews: loading view ['+ self._identity._id + ']',item);
						self.database.cfs.get(item,function(err,data) {
							if (err) {
								logger.log('error','Collection.loadViews ['	+ self._identity._id + ']',err);
								callback(err);
								return;
								} 
							else {
								logger.log('debug','Collection.loadViews - ['+ self._identity._id	+ '] creating view from ',data);
								var v = new View(self.database,	self, data);
		
								self._viewsHash[v.getId()] = v;
								self.views.push(v);
								if (self._identity._transient === true) {
									logger.log('debug','Collection.loadViews - ['+ self._identity._id + '] loading reduction ',v.getId());
									logger.log('debug','Collection.loadViews - ['+ self._identity._id + '] loading reduction from  ' + dir + '/view/');
									v.loadReduction(dir	+ '/view/',function(err) {
										if (err) {
											logger.log('error','Collection.loadViews ['+ self._identity._id+ ']',err);
											callback(err);
											return;
											}
										});
									} 
								else {
									// we moved this to the load documents
									//if (logger.level === 'debug')logger.log('debug','Collection.loadViews - ['+ self._identity._id+ '] reducing ',v.getId());
									//v.mapreduce(self.documents);
									}
								callback();
							}
						});
					}, callback);
				}
			});
		}
	else
		{
		logger.log('warn', 'Collection.loadViews [' + self._identity._id + '] ' + vdir + ' does not exist.');
		callback();
		}	
	});
};

Collection.prototype.addView = function(v,callback)
{
	var self = this;
	
	self.loadDocuments([ v ], function(err) {
		if (err) {
			callback(err);
			return;
		}

		self.setViewAt(v.getId(), v);
		self.views.push(v);
		self.database.addView(v);
		
		var dn = 'collection/' + self.getId() + '/views/';
		self.database.cfs.put(dn, v.getIdentity(), callback);
	});
};

Collection.prototype.updateView = function(v, callback) {
	var self = this;

	self.loadDocuments([ v ], function(err) {
		if (err) {
			callback(err);
			return;
		}
		
		if (v._identity._exception)
			{
			callback(v._identity._exception);
			return;
			}
		
		var dn = 'collection/' + self.getId() + '/views/';
		self.database.cfs.put(dn, v.getIdentity(), callback);
	});
};	

Collection.prototype.removeView = function(vid,callback)
{
	var v = this._viewsHash[vid];
	if (v)
		{
		var idx = this.views.indexOf(v);
		if (idx != -1)
			{
			this.views.splice(idx,1);
			delete this._viewsHash[vid];
			
			this.database.removeView(vid);
			
			var dir = 'collection/' + this._identity._id;
			var dn = dir + '/views/';
			
			// nuke the view file
			// TODO go clean up all the subdirectory docs.
			var fn = dn + vid + '.json';
			
			this.database.cfs.del(fn, callback);
			// should we put it back in, if the delete fails??
			}
		else
			{
			var msg = 'Collection.removeView - View ' + vid + ' not found in array.';
			logger.log('warn', msg);
			callback(msg);
			}
		}
	else
		{
		var msg = 'Collection.removeView - View ' + vid + ' not found.';
		logger.log('warn', msg);
		callback(msg);
		}
};


function removeFiles(c, deleteFiles, callback) {
	if (c._identity._transient || !deleteFiles) {
		callback();
		return;
	}
	var dn = 'collection/' + c.getId() + '/documents/';
	// grab all the collections from the file system
	c.database.cfs.list(dn, function(err, files) {
		if (err) {
			logger.log('error', 'Collection.removeFiles ', err);
			callback(err);
			return;
		}
		async.eachLimit(files, eachLimit, function(item, callback2) {
			c.database.cfs.del(item, callback2);
		}, callback);
	});
}

Collection.prototype.clear = function(deleteFiles, notify, callback) {
	
	var self = this;
	//self.documents = [];
	self._workingdocs = [];
	self.stats.fileCount = 0;

	removeFiles(self, deleteFiles, function(err) {
		if (err) {
			callback(err);
			return;
		}
		// TODO we need to nuke off the file system
		self.views.forEach(function(v) {
			v.reset();
			if (notify)
				v._emitter.emit('change');
		});

		callback();

	});
};

Collection.prototype.put = function(body, callback) {

	if (body.length === 0) {
		callback();
		return;
	}

	var self = this;
	self.stats.fileCount += body.length;

	// TODO maybe not required
	body.forEach(function(item) {
		if (!item._identity)
			item._identity = new Identity();
	});

	
	var dn = 'collection/' + self._identity._id + '/documents/';
	
	// write first
	// TODO, implement some sort of rollback 
	// in the event of a write failure
	function write(item, callback) {
		self.database.cfs.put(dn, item, callback);
	}

	if (self._identity._transient !== true) {
		async.eachLimit(body, eachLimit, write, function(err)
				{
				if (err)
					callback(err);
				else
					{
					self.push.apply(self, body);
					callback();
					}
				});
	} else
		{
		self.push.apply(self, body);
		callback();
		}
};

Collection.prototype.setViewAt = function(idx,val) {
	this._viewsHash[idx] = val;
};

Collection.prototype.viewAt = function(idx) {
	return this._viewsHash[idx];
};

Collection.prototype.toString = function() {
	return this._identity;
};

Collection.prototype.getIdentity = function() {
	return this._identity;
};

Collection.prototype.getId = function()
{
	return this._identity._id;
};

Collection.prototype.isTransient = function()
{
	return this._identity._transient;
};

module.exports = Collection;