// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
/*jslint node: true, white: true, nomen: true */
/*global describe, it */
"use strict";
var expect = require('expect.js');
var mbta = require('../cfs/mbtaOccupancy.js');
var Mbtavehicles = require('../cfs/mbtavehicles.js');

describe('mbtaOccupancy', function () {
    it('maps occupancy_status to crowding score', function () {
        expect(mbta.scoreFromStatus('FULL')).to.be(1);
        expect(mbta.scoreFromStatus('FEW_SEATS_AVAILABLE')).to.be(0.55);
        expect(mbta.scoreFromStatus('NO_DATA_AVAILABLE')).to.be(null);
    });

    it('documentFromVehicle includes crowding when occupancy present', function () {
        var doc = mbta.documentFromVehicle({
            type: 'vehicle',
            id: 'y1857',
            attributes: {
                latitude: 42.36,
                longitude: -71.06,
                occupancy_status: 'FEW_SEATS_AVAILABLE',
                revenue_status: 'REVENUE'
            },
            relationships: {
                route: { data: { id: '1', type: 'route' } }
            }
        });
        expect(doc.vehicle_id).to.be('y1857');
        expect(doc.crowding).to.be(0.55);
        expect(doc.lng).to.be(-71.06);
    });

    it('skips vehicles without crowding data', function () {
        var doc = mbta.documentFromVehicle({
            type: 'vehicle',
            id: 'x1',
            attributes: {
                latitude: 42.36,
                longitude: -71.06,
                occupancy_status: null,
                revenue_status: 'REVENUE'
            }
        });
        expect(doc).to.be(null);
    });
});

describe('mbtavehicles', function () {
    it('handleVehicleResource records throttle state', function () {
        var lastPost = new Map(),
            stats = { posted: 0 };
        Mbtavehicles.handleVehicleResource({
            type: 'vehicle',
            id: 'y1',
            attributes: {
                latitude: 42.36,
                longitude: -71.06,
                occupancy_status: 'FULL',
                revenue_status: 'REVENUE'
            }
        }, lastPost, stats);
        expect(lastPost.has('y1')).to.be(true);
    });
});
