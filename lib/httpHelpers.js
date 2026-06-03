// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
"use strict";

function collectionParam(req) {
    return req.params.cid || req.params.id;
}

function viewParam(req) {
    return req.params.vid;
}

function getCollection(database, req, res) {
    var cid = collectionParam(req),
        c = database.collectionAt(cid);
    if (!c) {
        res.status(404).send("collection " + cid + " is not in the database.");
    }
    return c;
}

function getView(database, req, res) {
    var view, c = getCollection(database, req, res);
    if (!c) {
        return c;
    }
    view = c.viewAt(viewParam(req));
    if (!view) {
        res.status(404).send("view " + viewParam(req) + " is not in the collection.");
    }
    return view;
}

function updateDatabaseStats(database, dirname) {
    database.getIdentity().hosts = database.globalSettings.hosts;
    database.getIdentity().port = database.globalSettings.port;
    database.getIdentity().memory = process.memoryUsage();
    database.getIdentity().uptime = process.uptime();
    database.getIdentity().dirname = dirname;

    var val = { totalReduceTime: 0, collections: {} };
    database.collections.forEach(function (value, key) {
        val.collections[key] = value.getStats();
        val.totalReduceTime += val.collections[key].stats.totalReduceTime;
    });

    database.getIdentity().stats = val;
}

module.exports = {
    collectionParam,
    viewParam,
    getCollection,
    getView,
    updateDatabaseStats
};
