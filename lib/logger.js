// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
"use strict";
const winston = require('winston');

/**
 * Build a Winston logger from settings.winston (same shape as settings.json).
 * @param {object} globalSettings
 * @returns {import('winston').Logger}
 */
function createLogger(globalSettings) {
    const logger = winston.createLogger(globalSettings.winston.options);

    globalSettings.winston.transports.forEach(function (item) {
        logger.add(new winston.transports[item[0]](item[1]));
    });

    return logger;
}

module.exports = {
    createLogger
};
