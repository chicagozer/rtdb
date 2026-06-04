// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
/*jslint node: true, white: true, nomen: true */
/*global describe, it */
"use strict";
var expect = require('expect.js');
var trajectory = require('../cfs/geopsTrajectory.js');
var Geops = require('../cfs/geopstrains.js');

describe('geopsTrajectory', function () {
    it('positionFromFeature interpolates mercator LineString to lng/lat', function () {
        var now = Date.now(),
            feature = {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [[950000, 6000000], [951000, 6000100]]
                },
                properties: {
                    train_id: 'sbb_test',
                    delay: 90,
                    line: { name: 'S5' },
                    type: 'rail',
                    time_intervals: [
                        [now - 60000, 0, 0],
                        [now + 60000, 1, 0]
                    ]
                }
            },
            doc = trajectory.positionFromFeature(feature);

        expect(doc).to.be.ok();
        expect(doc.train_id).to.be('sbb_test');
        expect(doc.lng).to.be.within(8, 9);
        expect(doc.lat).to.be.within(47, 48);
        expect(doc.delay).to.be(90);
        expect(doc.line).to.be('S5');
    });
});

describe('geopstrains', function () {
    it('handleMessage posts trajectory positions', function () {
        var posted = [],
            lastPost = new Map(),
            now = Date.now(),
            msg = {
                source: 'trajectory',
                content: {
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: [[950000, 6000000], [951000, 6000100]]
                    },
                    properties: {
                        train_id: 'sbb_x',
                        delay: 10,
                        type: 'rail',
                        time_intervals: [
                            [now - 60000, 0, 0],
                            [now + 60000, 1, 0]
                        ]
                    }
                }
            };

        Geops.handleMessage(msg, lastPost, function (doc, map) {
            Geops.postPosition(doc, map);
        });
        expect(lastPost.has('sbb_x')).to.be(true);
    });
});
