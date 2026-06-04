// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
"use strict";

var R = 6378137;

function mercatorToLngLat(xy) {
    return [
        (xy[0] / R) * (180 / Math.PI),
        (2 * Math.atan(Math.exp(xy[1] / R)) - Math.PI / 2) * (180 / Math.PI)
    ];
}

function pointAlongLine(coords, fraction) {
    var lengths = [],
        total = 0,
        i,
        seg,
        t,
        target;

    if (!coords || coords.length < 1) {
        return null;
    }
    if (coords.length === 1) {
        return coords[0];
    }
    if (fraction <= 0) {
        return coords[0];
    }
    if (fraction >= 1) {
        return coords[coords.length - 1];
    }
    for (i = 1; i < coords.length; i = i + 1) {
        seg = Math.hypot(coords[i][0] - coords[i - 1][0],
            coords[i][1] - coords[i - 1][1]);
        lengths.push(seg);
        total += seg;
    }
    target = fraction * total;
    for (i = 0; i < lengths.length; i = i + 1) {
        if (target <= lengths[i]) {
            t = lengths[i] ? target / lengths[i] : 0;
            return [
                coords[i][0] + t * (coords[i + 1][0] - coords[i][0]),
                coords[i][1] + t * (coords[i + 1][1] - coords[i][1])
            ];
        }
        target -= lengths[i];
    }
    return coords[coords.length - 1];
}

function fractionAtTime(timeIntervals, now) {
    var i,
        t0,
        f0,
        t1,
        f1,
        span;

    if (!timeIntervals || !timeIntervals.length) {
        return 0;
    }
    for (i = 0; i < timeIntervals.length - 1; i = i + 1) {
        t0 = timeIntervals[i][0];
        f0 = timeIntervals[i][1];
        t1 = timeIntervals[i + 1][0];
        f1 = timeIntervals[i + 1][1];
        if (now >= t0 && now <= t1) {
            span = t1 - t0;
            return span ? f0 + (f1 - f0) * (now - t0) / span : f0;
        }
    }
    if (now < timeIntervals[0][0]) {
        return timeIntervals[0][1];
    }
    return timeIntervals[timeIntervals.length - 1][1];
}

function trajectoryActive(timeIntervals) {
    var last;

    if (!timeIntervals || !timeIntervals.length) {
        return false;
    }
    last = timeIntervals[timeIntervals.length - 1][0];
    return Date.now() <= last + 120000;
}

function positionFromFeature(feature) {
    var props,
        trainId,
        frac,
        xy,
        lngLat,
        delay;

    if (!feature || !feature.properties || !feature.geometry) {
        return null;
    }
    props = feature.properties;
    trainId = props.train_id;
    if (!trainId || !feature.geometry.coordinates) {
        return null;
    }
    if (!trajectoryActive(props.time_intervals)) {
        return null;
    }
    frac = fractionAtTime(props.time_intervals, Date.now());
    xy = pointAlongLine(feature.geometry.coordinates, frac);
    if (!xy) {
        return null;
    }
    lngLat = mercatorToLngLat(xy);
    delay = props.delay === null || props.delay === undefined ? 0 : props.delay;
    return {
        _ts: Date.now(),
        train_id: trainId,
        lng: lngLat[0],
        lat: lngLat[1],
        delay: delay,
        line: props.line && props.line.name,
        mot: props.type
    };
}

module.exports = {
    mercatorToLngLat: mercatorToLngLat,
    pointAlongLine: pointAlongLine,
    fractionAtTime: fractionAtTime,
    trajectoryActive: trajectoryActive,
    positionFromFeature: positionFromFeature
};
