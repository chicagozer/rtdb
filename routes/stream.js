// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
"use strict";
const async = require('async');
const Symmetry = require('symmetry');
const Identity = require('../identity');

function addStream(req, res, view, delta, logger) {
    var myReduction, data, sub;

    sub = {
        res: res
    };

    sub._identity = new Identity();
    sub._identity.headers = req.headers;
    sub._identity.delta = delta;

    view.subscriptions[sub._identity._id] = sub;

    function drain() {
        var draindata;
        logger.log('info', 'drain - subscription:', sub._identity._id);
        if (sub.data) {
            if (sub._identity.delta) {
                draindata = Symmetry.diff(sub.last, sub.data);
            } else {
                draindata = sub.data;
            }

            sub.last = sub.data;

            res.write('event: ');
            res.write(view._identity._id + '\n');
            res.write("data: ");
            sub.overflow = !res.write(JSON.stringify(draindata) + '\n\n');
            if (res.flush) {
                res.flush();
            }
        }
        delete sub.data;
    }

    function remove() {
        delete view.subscriptions[sub._identity._id];
    }
    res.on('end', remove);
    res.on('close', remove);
    res.on('drain', drain);

    myReduction = view.personalize(sub._identity._id);
    data = JSON.stringify(myReduction);
    if (sub._identity.delta) {
        sub.last = myReduction;
    }

    res.write('event: ');
    res.write(view._identity._id + '\n');
    res.write("data: ");
    sub.overflow = !res.write(data + '\n\n');
    if (res.flush) {
        res.flush();
    }
}

function register(app, ctx) {
    var database = ctx.database,
        logger = ctx.logger;

    app.get('/db/stream', function (req, res) {

        var vlist = [],
            verrlist = [],
            vidlist = [],
            ticketlist = [],
            delta = false,
            errticket = [],
            fail = false;

        if (Array.isArray(req.query.view)) {
            vidlist = req.query.view;
            ticketlist = req.query.ticket;
        } else {
            vidlist.push(req.query.view);
            ticketlist.push(req.query.ticket);
        }

        if (req.query.delta === 'true') {
            delta = true;
        }

        vidlist.forEach(function (vid) {
            var view = database.viewAt(vid);
            if (!view) {
                logger.log('warn', 'Database.stream - view [' + vid + '] not found.');
                verrlist.push(vid);
            } else {
                vlist.push(view);
            }
        });

        if (vlist.length !== vidlist.length) {
            res.status(404).send("Some views not found:" + verrlist);
            return;
        }

        if (database.getSettings().useACLTicket) {

            if (ticketlist.length !== vlist.length) {
                res.status(403).send("You must supply a ticket for each view.");
                return;
            }

            vlist.forEach(function (view, index) {
                if (!view.checkTicket(ticketlist[index])) {
                    fail = true;
                }
            });
            if (fail) {
                res.status(403).send("Invalid ticket(s):" + errticket);
                return;
            }
        }
        logger.log('debug', 'app.get stream: writing stream!!');
        if (res.setTimeout) {
            res.setTimeout(0);
        }
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
        });

        res.write("retry: 1000\n");
        res.flush();

        async.each(vlist, function (v, callback) {
            addStream(req, res, v, delta, logger);
            callback();
        });
    });

    app.get('/db/collections/:cid/views/:vid/stream', function (req, res) {

        var view, c = database.collectionAt(req.params.cid);
        if (!c) {
            res.status(404).send("collection " + req.params.cid + " is not in the database.");
            return;
        }

        view = c.viewAt(req.params.vid);

        if (!view) {
            res.status(404).send("view " + req.params.vid + " is not in the collection.");
            return;
        }

        res.setTimeout(0);
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        });

        res.write("retry: 1000\n");

        addStream(req, res, view, false, logger);
    });
}

module.exports = {
    register,
    addStream
};
