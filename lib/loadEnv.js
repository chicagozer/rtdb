// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
"use strict";
var fs = require('fs');
var path = require('path');

function loadEnvFile(filename) {
    var file = path.join(__dirname, '..', filename),
        line, match, val, lines, i;

    if (!fs.existsSync(file)) {
        return;
    }

    lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (i = 0; i < lines.length; i = i + 1) {
        line = lines[i].trim();
        if (!line || line.charAt(0) === '#') {
            continue;
        }
        match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!match || process.env[match[1]] !== undefined) {
            continue;
        }
        val = match[2].trim();
        if ((val.charAt(0) === '"' && val.charAt(val.length - 1) === '"') ||
                (val.charAt(0) === "'" && val.charAt(val.length - 1) === "'")) {
            val = val.slice(1, -1);
        }
        process.env[match[1]] = val;
    }
}

module.exports = {
    loadEnvFile: loadEnvFile
};
