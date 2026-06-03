// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
"use strict";
const express = require('express');
const compression = require('compression');
const errorHandler = require('errorhandler');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const path = require('path');
const http = require('http');

function configureApp(database, logger, rootDir) {
    var env, app = express();

    logger.log('debug', 'configureApp - started.');

    if (database.globalSettings.maxSockets) {
        logger.log('debug', 'configureApp - maxSockets:',
            database.globalSettings.maxSockets);
        http.globalAgent.maxSockets = database.globalSettings.maxSockets;
    }

    app.use(bodyParser.json({
        limit: '50mb'
    }));
    app.use(bodyParser.urlencoded({
        extended: true,
        limit: '50mb'
    }));
    app.use(methodOverride());

    app.use(compression());
    app.use(express.static(rootDir + path.sep + 'public'));
    app.set('views', rootDir + '/views');
    app.set('view engine', 'pug');
    app.set('wsport', database.globalSettings.wsport);

    app.use(function (req, res, next) {
        res.header("Access-Control-Allow-Origin", database.getSettings().corsOrigin);
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });

    env = process.env.NODE_ENV || 'development';
    if ('development' === env) {
        app.use(errorHandler());
        app.locals.pretty = true;
    }

    return app;
}

module.exports = {
    configureApp
};
