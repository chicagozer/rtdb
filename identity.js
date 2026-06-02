// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
/*jslint node: true, white: true, nomen: true */
"use strict";
const { randomUUID } = require('crypto');

function Identity() {
    this._id = randomUUID();
    this._ts = new Date();
}

module.exports = Identity;
