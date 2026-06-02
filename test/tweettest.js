var assert = require('assert');
var sinon = require('sinon');
var http = require('http');

describe('Tweet CFS', function() {
    var Tweet, httpRequestStub;

    before(function() {
        process.env.NODE_ENV = 'test';
        Tweet = require('../cfs/tweet.js');
    });

    beforeEach(function() {
        httpRequestStub = sinon.stub(http, 'request');
    });

    afterEach(function() {
        httpRequestStub.restore();
    });

    it('should doPost successfully', function(done) {
        var mockReq = {
            write: function(data) {
                var parsed = JSON.parse(data);
                assert.equal(parsed.text, 'hello world');
            },
            end: function() {
                done();
            },
            on: function() {}
        };
        httpRequestStub.returns(mockReq);

        Tweet.doPost({ text: 'hello world' });
    });

    it('should cleanup old files gracefully', function(done) {
        // Just verify it doesn't crash. In a real test we'd mock fs
        Tweet.cleanup();
        setTimeout(done, 100);
    });

});
