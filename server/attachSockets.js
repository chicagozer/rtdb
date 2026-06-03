// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
"use strict";
const socketio = require('socket.io');
const Identity = require('../identity');

function attachSockets(server, database, logger) {
    database.io = socketio(server, {
        'logger': logger,
        'transports': ['websocket']
    });

    database.io.on('connection', function (socket) {

        var idlist = [];

        function subscribe(data, volatile) {
            var vidlist = [];
            if (Array.isArray(data)) {
                vidlist = data;
            } else {
                vidlist.push(data);
            }

            vidlist.forEach(function (vid) {

                var myReduction, sub, view = database.viewAt(vid.view);
                if (!view) {
                    logger.log('warn', 'Database.subscribe - view [' + vid + '] not found.');
                } else {

                    if (!database.getSettings().useACLTicket || view.checkTicket(vid.ticket)) {

                        sub = {
                            socket: socket,
                            volatile: volatile
                        };

                        sub._identity = new Identity();
                        sub._identity.headers = socket.handshake.headers;
                        sub._identity.delta = vid.delta;

                        view.subscriptions[sub._identity._id] = sub;
                        idlist.push({
                            view: view,
                            id: sub._identity._id
                        });
                        logger.log('debug', 'Database.socket - subscribe view:' + view._identity._id + ' subscription:' + sub._identity._id);
                        myReduction = view.personalize(sub._identity._id);
                        if (volatile) {
                            socket.volatile.emit(view._identity._id, myReduction);
                        } else {
                            socket.emit(view._identity._id, myReduction);
                        }
                    }
                }
            });
        }

        socket.on('subscribe', function (data) {
            logger.log('debug', 'Database.socket -subscribe');
            subscribe(data, false);
        });

        socket.on('subscribev', function (data) {
            logger.log('debug', 'Database.socket -subscribev');
            subscribe(data, true);
        });

        socket.on('disconnect', function () {
            idlist.forEach(function (key) {

                logger.log('debug', 'Database.socket - disconnect view:' + key.view._identity._id + ' subscription:' + key.id);

                delete key.view.subscriptions[key.id];
            });
        });

        /*jslint unparam: true */
        socket.on('unsubscribe', function (data) {
            return undefined;
        });
        /*jslint unparam: false */
    });

    return database.io;
}

module.exports = {
    attachSockets
};
