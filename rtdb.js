// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
/*jslint node: true, white: true, nomen: true */
/*jshint laxbreak: true */
"use strict";
const fs = require('fs');
const Database = require('./db');
const { createLogger } = require('./lib/logger');
const { loadExpress } = require('./server/loadExpress');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv)).argv;

function Rtdb() {
    this.servers = [];
}

Rtdb.prototype.stop = function (done) {
    this.servers.forEach(function (server) {
        server.close();
    });
    done();
};

Rtdb.prototype.start = function (done) {
    var database, globalSettings = null,
        settingsFile = null,
        logger,
        startTime = new Date().getTime(),
        self = this;

    if (!argv.help) {
        if (argv.settings) {
            settingsFile = argv.settings;
        } else {
            settingsFile = 'settings/settings.json';
        }
    } else {
        done(new Error('\nrtdb [--settings settingsfile] [--help] [--port portnum] [--host listenhost]'));
        return;
    }

    /*jslint stupid: true */
    if (fs.existsSync(settingsFile)) {
        globalSettings = JSON.parse(fs.readFileSync(settingsFile));
        /*jslint stupid: false */
        logger = createLogger(globalSettings);
        globalSettings.logger = logger;
        global.logger = logger;
    } else {
        done(new Error('Settings file not found at - ' + settingsFile));
        return;
    }
    logger.log('info', 'Settings loaded from ' + settingsFile + '.');

    if (argv.port) {
        globalSettings.port = argv.port;
    }

    if (argv.host) {
        if (Array.isArray(argv.host)) {
            globalSettings.hosts = argv.host;
        } else {
            globalSettings.hosts = [argv.host];
        }
    }

    if (!globalSettings.port) {
        globalSettings.port = process.env.PORT || process.env.VCAP_APP_PORT || process.env.OPENSHIFT_NODEJS_PORT || 9001;
    }

    if (process.env.OPENSHIFT_NODEJS_PORT) {
        globalSettings.wsport = 8443;
    }

    if (!globalSettings.hosts && (process.env.HOST || process.env.OPENSHIFT_NODEJS_IP)) {
        globalSettings.hosts = [process.env.HOST || process.env.OPENSHIFT_NODEJS_IP];
    }

    database = new Database(globalSettings, function () {
        loadExpress(self, database, startTime, done);
    });
};

module.exports = Rtdb;
