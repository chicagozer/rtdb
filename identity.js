// © 2014 by Rheosoft. All rights reserved. 
// Licensed under the RTDB Software License version 1.0
/*jslint node: true, white: true, nomen: true */
"use strict";
var uuid = require('node-uuid');

function Identity() {
	this._id = uuid.v4();
	this._ts = new Date();
}

module.exports = Identity;
