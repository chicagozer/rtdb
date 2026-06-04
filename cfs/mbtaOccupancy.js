// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
"use strict";

var STATUS_SCORE = {
    MANY_SEATS_AVAILABLE: 0.2,
    FEW_SEATS_AVAILABLE: 0.55,
    FULL: 1.0,
    STANDING_ROOM_ONLY: 0.75,
    CRUSHED_STANDING_ROOM_ONLY: 0.9,
    EMPTY: 0.05
};

function scoreFromStatus(status) {
    if (!status || STATUS_SCORE[status] === undefined) {
        return null;
    }
    return STATUS_SCORE[status];
}

function crowdingFromVehicleResource(resource) {
    var attrs, carriages, i, c, score, max = 0;

    if (!resource || !resource.attributes) {
        return null;
    }
    attrs = resource.attributes;
    carriages = attrs.carriages;
    if (carriages && carriages.length) {
        for (i = 0; i < carriages.length; i = i + 1) {
            c = carriages[i];
            if (c.occupancy_percentage != null) {
                score = Math.min(1, Math.max(0, c.occupancy_percentage / 100));
            } else {
                score = scoreFromStatus(c.occupancy_status);
            }
            if (score != null && score > max) {
                max = score;
            }
        }
        if (max > 0) {
            return max;
        }
    }
    return scoreFromStatus(attrs.occupancy_status);
}

function documentFromVehicle(resource) {
    var attrs, crowding, routeId, tripId;

    if (!resource || resource.type !== 'vehicle') {
        return null;
    }
    attrs = resource.attributes;
    if (attrs.latitude == null || attrs.longitude == null) {
        return null;
    }
    if (attrs.revenue_status === 'NON_REVENUE') {
        return null;
    }
    crowding = crowdingFromVehicleResource(resource);
    if (crowding == null) {
        return null;
    }
    routeId = resource.relationships &&
        resource.relationships.route &&
        resource.relationships.route.data &&
        resource.relationships.route.data.id;
    tripId = resource.relationships &&
        resource.relationships.trip &&
        resource.relationships.trip.data &&
        resource.relationships.trip.data.id;

    return {
        _ts: Date.now(),
        vehicle_id: resource.id,
        lng: attrs.longitude,
        lat: attrs.latitude,
        crowding: crowding,
        occupancy_status: attrs.occupancy_status || null,
        route_id: routeId || null,
        trip_id: tripId || null,
        label: attrs.label || null,
        mode_status: attrs.current_status || null
    };
}

module.exports = {
    crowdingFromVehicleResource: crowdingFromVehicleResource,
    documentFromVehicle: documentFromVehicle,
    scoreFromStatus: scoreFromStatus
};
