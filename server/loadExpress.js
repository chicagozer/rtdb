// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
"use strict";
const http = require('http');
const path = require('path');
const { configureApp } = require('./configureApp');
const { attachSockets } = require('./attachSockets');
const authMiddleware = require('../middleware/auth');
const streamRoutes = require('../routes/stream');
const adminRoutes = require('../routes/admin');
const collectionsRoutes = require('../routes/collections');
const viewsRoutes = require('../routes/views');
const pagesRoutes = require('../routes/pages');

function loadExpress(rtdb, database, startTime, done) {
    var server, app, ctx, rootDir = path.join(__dirname, '..'),
        logger = database.logger;

    app = configureApp(database, logger, rootDir);
    authMiddleware.register(app, database);

    ctx = {
        database: database,
        logger: logger,
        dirname: rootDir
    };

    streamRoutes.register(app, ctx);
    adminRoutes.register(app, ctx);
    collectionsRoutes.register(app, ctx);
    viewsRoutes.register(app, ctx);
    pagesRoutes.register(app, ctx);

    server = http.createServer(app);
    attachSockets(server, database, logger);

    if (database.getSettings().hosts) {
        database.getSettings().hosts.forEach(function (host) {
            rtdb.servers.push(server.listen(database.getSettings().port, host));
            logger.log('info', 'rtdb (' + database.getIdentity()._pjson.version + ') is listening on ' + host + ':' + database.getSettings().port + ' ...');
        });
    } else {
        rtdb.servers.push(server.listen(database.getSettings().port));
        logger.log('info', 'rtdb (' + database.getIdentity()._pjson.version + ') is listening on ' + database.getSettings().port + ' ...');
    }

    logger.log('info', database.getIdentity().copyright);
    logger.log('info',
        'for more info, visit https://rtdb.rheosoft.com/about/.');

    database.getIdentity().startupTime = new Date().getTime() - startTime;
    done();
}

module.exports = {
    loadExpress
};
