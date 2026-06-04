// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
"use strict";

const Symmetry = require("symmetry");

/**
 * Diff two reductions for delta SSE/socket subscribers.
 * The symmetry npm package names this createPatch; browser clients use patch.js.
 */
function diff(left, right) {
    return Symmetry.createPatch(left, right);
}

/**
 * Apply a diff in-place (matches public/symmetry/patch.js on the client).
 */
function patch(val, patchVal) {
    if (patchVal === "none") {
        return val;
    }
    return Symmetry.applyPatch.inPlace(val, patchVal);
}

module.exports = {
    diff,
    patch,
};
