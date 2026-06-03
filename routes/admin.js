// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
"use strict";
const { updateDatabaseStats, collectionParam } = require('../lib/httpHelpers');

function register(app, ctx) {
    var database = ctx.database,
        logger = ctx.logger,
        dirname = ctx.dirname;

    app.get('/db/admin/echo', function (req, res) {
        res.send(req.headers);
    });

    /*jslint unparam:true */
    app.post('/db/admin/stop', function (req, res) {
        database.saveViews(function () {
            process.exit();
        });
        res.status(202).end();
    });
    /*jslint unparam:false */

    /*jslint unparam:true */
    app.post('/db/admin/gc', function (req, res) {
        if (global.gc) {
            global.gc();
            logger.log('info', 'gc - gc called.');
        } else {
            logger.log('warn', 'gc - set --enable-gc to allow gc.');
        }
        logger.log('info', 'gc - ' + JSON.stringify(process.memoryUsage()));

        res.send(process.memoryUsage());
    });
    /*jslint unparam:false */

    app.post('/db/collections/:cid/load', function (req, res) {
        var cid = collectionParam(req),
            c = database.collectionAt(cid);
        if (!c) {
            res.status(404).send("collection " + cid + " is not in the database.");
            return;
        }
        c.clear(false, false, function (err) {
            if (err) {
                res.status(500).send(err);
                return;
            }
            c.loadDocuments(Array.from(c.views.values()), function (err) {
                if (!err) {
                    res.status(200).end();
                } else {
                    res.status(500).send(err);
                }
            });
        });
    });

    /*jslint unparam:true */
    app.get("/db/admin/stats", function (req, res) {
        updateDatabaseStats(database, dirname);
        res.send(database.getIdentity());
    });
    /*jslint unparam:false */

    /*jslint unparam:true */
    app.get("/web/admin/stats", function (req, res) {
        updateDatabaseStats(database, dirname);
        res.render('stats', {
            json: database.getIdentity()
        });
    });
    /*jslint unparam:false */
}

module.exports = {
    register
};
