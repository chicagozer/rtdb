// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
"use strict";
const assert = require("assert");
const Symmetry = require("../symmetryRt");

describe("symmetryRt", function () {
    it("diff and patch round-trip on arrays", function () {
        var left = [1, 2, 3];
        var right = [1, 2, 4];
        var patch = Symmetry.diff(left, right);
        assert.notEqual(patch, "none");
        Symmetry.patch(left, patch);
        assert.deepStrictEqual(left, right);
    });

    it("diff returns none when values are equal", function () {
        var val = { a: 1, b: [2, 3] };
        assert.strictEqual(Symmetry.diff(val, { a: 1, b: [2, 3] }), "none");
    });
});
