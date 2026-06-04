// © 2014-2026 by Rheosoft. All rights reserved.
// Licensed under the RTDB Software License version 1.0
/*jslint node: true, white: true, nomen: true */
/*global describe, it */
"use strict";
var expect = require('expect.js');
var Dow30 = require('../cfs/dow30quotes.js');

describe('dow30quotes', function () {
    it('normalizeTrade maps Finnhub fields', function () {
        var doc = Dow30.normalizeTrade({ s: 'AAPL', p: 190.5, v: 10, t: 123 });
        expect(doc.symbol).to.be('AAPL');
        expect(doc.p).to.be(190.5);
        expect(doc.v).to.be(10);
        expect(doc.t).to.be(123);
        expect(doc._ts).to.be.a('number');
    });

    it('loadSymbols returns all Dow 30 tickers', function () {
        expect(Dow30.loadSymbols().length).to.be(30);
    });
});
