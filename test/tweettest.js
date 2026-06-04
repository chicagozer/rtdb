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

    it('matchesTopic accepts hashtags only', function() {
        assert(Tweet.matchesTopic('hello #nodejs world'));
        assert(!Tweet.matchesTopic('talking about rtdb today'));
        assert(!Tweet.matchesTopic('plain post with no topic signal'));
    });

    it('matchesLang accepts English BCP-47 tags', function() {
        assert(Tweet.matchesLang({ langs: ['en'] }));
        assert(Tweet.matchesLang({ langs: ['en-US'] }));
        assert(!Tweet.matchesLang({ langs: ['fr'] }));
        assert(!Tweet.matchesLang({}));
    });

    it('ingestDecision requires create commits with text', function() {
        var msg = {
            commit: {
                operation: 'create',
                record: { text: '#demo', langs: ['en'] }
            }
        };
        assert.equal(Tweet.ingestDecision(msg), 'post');
        assert.equal(Tweet.ingestDecision({
            commit: { operation: 'delete', record: { text: '#demo' } }
        }), 'notCreate');
        assert.equal(Tweet.ingestDecision({
            commit: { operation: 'create', record: { text: 'no topic here', langs: ['en'] } }
        }), 'noTopic');
        assert.equal(Tweet.ingestDecision({
            commit: { operation: 'create', record: { text: '#demo', langs: ['de'] } }
        }), 'noLang');
    });

});
