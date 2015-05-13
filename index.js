// © 2014 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
/*jslint node: true, white: true, nomen: true */
/*jshint laxbreak: true */
"use strict";
var Rtdb = require('./rtdb');

var myrtdb = new Rtdb();
myrtdb.start(function(err) {
    if (err) {
        console.dir(err);
        process.exit();
    }

});