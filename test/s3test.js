var assert = require('assert');
var sinon = require('sinon');
var CfsS3 = require('../cfs/cfss3.js');
const { Readable } = require('stream');

describe('S3 CFS', function() {
    var s3cfs, stubs = {};

    before(function() {
        process.env.NODE_ENV = 'test';
        process.env.AWS_SECRET = 'test-secret';
        process.env.AWS_KEY = 'test-key';
        process.env.AWS_BUCKET = 'test-bucket';
        s3cfs = new CfsS3();
        s3cfs.init({
            s3: {
                bucket: 'test-bucket',
                accessKeyId: 'test-key',
                secretAccessKey: 'test-secret',
                region: 'us-east-1'
            }
        });
    });

    beforeEach(function() {
        stubs.listObjects = sinon.stub(s3cfs.s3, 'listObjects');
        stubs.putObject = sinon.stub(s3cfs.s3, 'putObject');
        stubs.getObject = sinon.stub(s3cfs.s3, 'getObject');
        stubs.deleteObject = sinon.stub(s3cfs.s3, 'deleteObject');
    });

    afterEach(function() {
        sinon.restore();
    });

    it('should implement name', function() {
        assert.equal(s3cfs.name(), 'CFSS3');
    });

    it('should list objects', function(done) {
        stubs.listObjects.callsFake(function(opts, cb) {
            cb(null, { Contents: [{ Key: 'folder/file1.json', Size: 10 }, { Key: 'folder/file2.json', Size: 10 }] });
        });
        
        s3cfs.list('folder/', function(err, files) {
            assert(!err);
            assert.equal(files.length, 2);
            assert.equal(files[0], 'folder/file1.json');
            done();
        });
    });

    it('should list objects (empty)', function(done) {
        stubs.listObjects.callsFake(function(opts, cb) {
            cb(null, { Contents: [] });
        });
        
        s3cfs.list('folder/', function(err, files) {
            assert(!err);
            assert.equal(files.length, 0);
            done();
        });
    });

    it('should put object', function(done) {
        stubs.putObject.callsFake(function(opts, cb) {
            cb(null, {});
        });
        
        s3cfs.put('folder/', { _identity: { _id: '123' }, data: 'test' }, function(err) {
            assert(!err);
            done();
        }, 100);
    });

    it('should get object', function(done) {
        stubs.getObject.callsFake(function(opts, cb) {
            cb(null, {
                Body: {
                    transformToString: function() {
                        return Promise.resolve(JSON.stringify({ hello: 'world' }));
                    }
                }
            });
        });
        
        s3cfs.get('folder/123.json', function(err, data) {
            assert(!err);
            assert.equal(data.hello, 'world');
            done();
        });
    });

    it('should delete object', function(done) {
        stubs.deleteObject.callsFake(function(opts, cb) {
            cb(null, {});
        });
        
        s3cfs.del('folder/123.json', function(err) {
            assert(!err);
            done();
        });
    });
});
