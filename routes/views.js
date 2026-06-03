// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
"use strict";
const View = require('../view');
const { getCollection, getView } = require('../lib/httpHelpers');

function register(app, ctx) {
    var database = ctx.database,
        logger = ctx.logger;

    app.get('/db/collections/:cid/views/:vid/stats', function (req, res) {
        var view = getView(database, req, res);
        if (view) {
            res.send(view.stats);
        }
    });

    app.get('/db/collections/:cid/views/:vid/ticket', function (req, res) {
        var view = getView(database, req, res);
        if (view) {
            res.send(JSON.stringify({
                ticket: view.issueTicket()
            }));
        }
    });

    app.get('/web/collections/:cid/views', function (req, res) {
        var list = [],
            c = getCollection(database, req, res);
        if (!c) {
            return;
        }
        Array.from(c.views.values()).forEach(function (item) {
            list.push(item._identity);
        });
        res.render('views', {
            json: list,
            cid: c._identity._id
        });
    });

    app.get('/web/collections/:cid/views/:vid', function (req, res) {
        var view = getView(database, req, res);
        if (view) {
            res.render('view', {
                json: view._identity,
                cid: req.params.cid
            });
        }
    });

    app.get('/web/collections/:cid/views/:vid/reduction', function (req, res) {
        var view = getView(database, req, res);
        if (!view) {
            return;
        }

        res.render('reduction', {
            json: Array.from(view.reduction.entries()),
            cid: req.params.cid,
            vid: req.params.vid,
            rid: view._redcontainer._identity._id
        });
    });

    app.get('/web/collections/:cid/views/:vid/stats', function (req, res) {
        var view = getView(database, req, res);
        if (!view) {
            return;
        }

        res.render('vstats', {
            json: view.stats,
            cid: req.params.cid,
            vid: req.params.vid,
            rid: view._redcontainer._identity._id
        });
    });

    app.get('/web/collections/:cid/views/:vid/subscriptions', function (req, res) {
        var index, list = [],
            view = getView(database, req, res);

        if (!view) {
            return;
        }
        for (index in view.subscriptions) {
            if (view.subscriptions.hasOwnProperty(index)) {
                list.push(view.subscriptions[index]._identity);
            }
        }
        res.render('subscriptions', {
            json: list,
            cid: req.params.cid,
            vid: req.params.vid
        });
    });

    app.post('/db/collections/:cid/views', function (req, res) {

        logger.debug('App.post - adding view to ' + req.params.cid);
        var v, c = getCollection(database, req, res);
        if (!c) {
            return;
        }

        if (req.body._id) {
            v = new View(database, c, req.body);
        } else {
            v = new View(database, c).init();
        }
        c.addView(v, function (err) {
            if (err) {
                logger.log('error', 'app.post - collections/view: ' + req.params.cid, err);
                res.status(500).send(err);
            } else {
                res.status(201).send(v.getIdentity());
            }
        });
    });

    app.put('/db/collections/:cid/views/:vid', function (req, res) {

        logger.debug('App.put - updating  view: ' + req.params.vid);
        var v, c = getCollection(database, req, res);
        if (!c) {
            return;
        }

        v = getView(database, req, res);
        if (!v) {
            return;
        }

        v.init(req.body._key, req.body._map, req.body._reduce,
            req.body._finalize, req.body._personalize);

        c.updateView(v, function (err) {
            if (err) {
                logger.log('error', 'app.put - collections/view: ' + req.params.cid + '/' + req.params.vid, err);
                res.status(500).send(err);
            } else {
                res.status(200).send(v.getIdentity());
            }
        });
    });

    app.get('/db/collections/:cid/views', function (req, res) {

        var list = [],
            c = getCollection(database, req, res);
        if (!c) {
            return;
        }

        Array.from(c.views.values()).forEach(function (item) {
            list.push(item._identity);
        });
        res.send(list);
    });

    /*jslint unparam:true */
    app.get('/db/collections/:cid/views/stream', function (req, res) {
        res.status(404).send("Method not yet implemented.");
    });
    /*jslint unparam:false */

    app.get('/db/collections/:cid/views/:vid', function (req, res) {

        var v = getView(database, req, res);
        if (!v) {
            return;
        }

        res.send(v.toString());
    });

    app.get('/db/collections/:cid/views/:vid/reduction', function (req, res) {

        var v = getView(database, req, res);
        if (!v) {
            return;
        }
        res.send(JSON.stringify(v.reduction));
    });

    app.delete('/db/collections/:cid/views/:vid', function (req, res) {
        var v, c = getCollection(database, req, res);
        if (!c) {
            return;
        }

        v = getView(database, req, res);
        if (!v) {
            return;
        }

        c.removeView(req.params.vid, function (err) {
            if (err) {
                logger.log('error', err);
                res.status(500).send(err);
            } else {
                res.status(200).end();
            }

        });

    });

    app.get('/db/collections/:cid/views/:vid/subscriptions',
        function (req, res) {

            var index, list = [],
                v = getView(database, req, res);
            if (!v) {
                return;
            }

            for (index in v.subscriptions) {
                if (v.subscriptions.hasOwnProperty(index)) {
                    list.push(v.subscriptions[index]._identity);
                }
            }

            res.send(list);
        });

    /*jslint unparam:true */
    app.get('/db/collections/:cid/views/:vid/subscriptions/stream', function (req, res) {
        res.status(404).send("Work in progress.");
    });
    /*jslint unparam:false */
}

module.exports = {
    register
};
