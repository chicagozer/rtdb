// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
"use strict";
const Collection = require('../collection');
const { getCollection, collectionParam } = require('../lib/httpHelpers');

function register(app, ctx) {
    var database = ctx.database,
        logger = ctx.logger;

    app.post('/db/collections/:cid/documents', function (req, res) {

        var docs = [],
            cid = collectionParam(req),
            c = database.collectionAt(cid);
        if (!c) {
            res.status(404).send("collection " + cid + " is not in the database.");
            return;
        }

        if (!Array.isArray(req.body)) {
            docs.push(req.body);
        } else {
            docs = req.body;
        }

        c.put(docs, function (err) {
            if (!err) {
                res.status(201).end();
            } else {
                res.status(500).send(err);
            }
        });
    });

    app.get('/db/collections/:cid/stats', function (req, res) {
        var c = getCollection(database, req, res);
        if (c) {
            res.send(c.getStats());
        }
    });

    /*jslint unparam:true */
    app.get('/web/collections', function (req, res) {
        var list = [];
        Array.from(database.collections.values()).forEach(function (item) {
            list.push(item.getIdentity());
        });

        res.render('collections', {
            json: list
        });
    });
    /*jslint unparam:false */

    /*jslint unparam:true */
    app.get('/web/collections/:cid', function (req, res) {
        var c = getCollection(database, req, res);
        if (c) {
            res.render('collection', {
                json: c._identity
            });
        }
    });
    /*jslint unparam:false */

    app.get('/web/collections/:cid/stats', function (req, res) {
        var c = getCollection(database, req, res);
        if (!c) {
            return;
        }

        res.render('cstats', {
            json: c.getStats(),
            cid: req.params.cid
        });
    });

    /*jslint unparam:true */
    app.get('/db/collections', function (req, res) {
        var list = [];
        Array.from(database.collections.values()).forEach(function (item) {
            list.push(item._identity);
        });
        res.send(list);
    });

    app.get('/db/collections/stream', function (req, res) {
        res.status(404).send("Method not yet implemented.");
    });

    app.get('/db/collections/:cid/documents/stream', function (req, res) {
        res.status(404).send("Method not yet implemented.");
    });
    /*jslint unparam:false */

    app.post('/db/collections', function (req, res) {

        var c;
        if (req.body._id) {
            c = new Collection(database, req.body);
        } else {
            c = new Collection(database).init();
        }

        database.addCollection(c, function (err) {
            if (err) {
                logger.log('error', 'app.post - collections', err);
                res.status(500).send(err);
            } else {
                res.status(201).send(c._identity);
            }
        });
    });

    app.put('/db/collections/:cid', function (req, res) {

        var c = getCollection(database, req, res);
        if (!c) {
            return;
        }
        c.init(req.body._key, req.body._transient, req.body._priority,
            req.body._expiration, req.body._onAdd);
        database.updateCollection(c, function (err) {
            if (err) {
                res.status(500).send(err);
            } else {
                res.status(200).end();
            }
        });
    });

    app.delete('/db/collections/:cid', function (req, res) {

        database.removeCollection(req.params.cid, function (err) {
            if (!err) {
                res.status(200).end();
            } else {
                res.status(500).send(err);
            }
        });

    });

    app.get('/db/collections/:cid', function (req, res) {
        var c = getCollection(database, req, res);
        if (!c) {
            return;
        }

        res.send(c.toString());
    });

    app.delete('/db/collections/:cid/documents', function (req, res) {

        var deleteFromDisk = false,
            c = getCollection(database, req, res);
        if (!c) {
            return;
        }

        if (req.query.permanent === 'true') {
            deleteFromDisk = true;
        }

        c.clear(deleteFromDisk, true, function (err) {
            if (err) {
                res.status(500).send(err);
            } else {
                res.status(204).end();
            }
        });
    });
}

module.exports = {
    register
};
