var assert = require('assert');
var sinon = require('sinon');
var http = require('http');
var fs = require('fs');
var path = require('path');

describe('Parcel CFS', function() {
    var Parcel, httpRequestStub;

    before(function() {
        process.env.NODE_ENV = 'test';
        Parcel = require('../cfs/parcel.js');
    });

    beforeEach(function() {
        httpRequestStub = sinon.stub(http, 'request').callsFake(function(options, callback) {
            if (callback) {
                var mockRes = {
                    setEncoding: function() {},
                    on: function(event, cb) {
                        if (event === 'end') cb();
                    }
                };
                callback(mockRes);
            }
            return {
                on: function() {},
                write: function() {},
                end: function() {}
            };
        });
    });

    afterEach(function() {
        httpRequestStub.restore();
    });

    it('should flush successfully', function(done) {
        var mockReq = {
            end: function(data) {
                assert.equal(data, '{}');
                done();
            },
            on: function() {}
        };
        httpRequestStub.returns(mockReq);

        Parcel.flush();
    });

    it('should handle readFile', function(done) {
        var dir = path.join(__dirname, '..', 'sampledb', 'parcels');
        var files = fs.readdirSync(dir);
        if (files.length > 0) {
            Parcel.readFile(files[0], function(err) {
                assert(!err);
                done();
            });
        } else {
            done();
        }
    });

    it('should handle main2', function(done) {
        var originalEachSeries = require('async').eachSeries;
        var readdirStub = sinon.stub(fs, 'readdir').yields(null, ['file1.json']);
        
        require('async').eachSeries = function(arr, iter, cb) {
            require('async').eachSeries = originalEachSeries;
            readdirStub.restore();
            done();
        };
        
        Parcel.main2();
    });
});
