// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
"use strict";
const auth = require('http-auth');
const authConnect = require('http-auth-connect');

function createBasicAuth(database) {
    return auth.basic({
        realm: "rtdb"
    }, function (username, password, callback) {
        if (database.getSettings().disableBasicAuth) {
            callback(true);
            return;
        }

        var reply = username === (process.env.RTDBADMIN_USER || 'admin') &&
            password === (process.env.RTDBADMIN_PWD || 'chang3m3');
        callback(reply);
    });
}

function register(app, database) {
    var basic = createBasicAuth(database);
    app.all('/web/*splat', authConnect(basic));
    app.all('/db/admin/*splat', authConnect(basic));
}

module.exports = {
    register,
    createBasicAuth
};
