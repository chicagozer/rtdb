var util = require('util'),
    twitter = require('twitter'),
	fs = require('fs'),
	path = require('path');
var twit = new twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY, 
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token_key: process.env.TWITTER_TOKEN_KEY,
    access_token_secret: process.env.TWITTER_TOKEN_SECRET
});


var http = require('http');

function Tweet() {
	return this;
}

function cleanup() {
var uploadsDir = __dirname + '/../sampledb/collection/e38201e5-e928-44a9-a17e-3ad3fd0a3ba7/documents';

fs.readdir(uploadsDir, function(err, files) {
	if (!files) {
		return;
		}
  files.forEach(function(file, index) {
    fs.stat(path.join(uploadsDir, file), function(err, stat) {
      var endTime, now;
      if (err) {
        return;
      }
      now = new Date().getTime();
      endTime = new Date(stat.ctime).getTime() + 300000;
      if (now > endTime) {
        return fs.unlink(path.join(uploadsDir, file), function(err) {
        });
      }
    });
  });
});
}

function doPost(data)
{

var userString = JSON.stringify(data);

var headers = {
  'Content-Type': 'application/json; charset=utf-8'
 };

var options = {
  host: 'localhost',
  port: process.env.PORT || process.env.VCAP_APP_PORT || process.env.OPENSHIFT_NODEJS_PORT || 9001,
  path: '/db/collections/e38201e5-e928-44a9-a17e-3ad3fd0a3ba7/documents',
  method: 'POST',
  headers: headers
};

// Setup the request.  The options parameter is
// the object we defined above.
var req = http.request(options, function(res) {
  res.setEncoding('utf-8');

  var responseString = '';

  res.on('data', function(data) {
    responseString += data;
  });

  res.on('end', function() {
  });
});

req.on('error', function(e) {
  // TODO: handle error.
});

req.write(userString);
req.end();
}


var match = 'php,nosql,jquery,nodejs,paas,clouddb,heroku,javascript,HTML5,hadoop,mongodb,json,websockets,jenkins,ruby,chef,puppet,ubuntu,centos,linux,oracle,mysql,salesforce,datatorrent';
var arrayMatch = match.split(',');

function tweet() {
 global.logger.log('info', 'tweet - startup.');
twit.stream('statuses/filter', { language: 'en', track: match }, function(stream) {
	stream.on('error', function(error) {
		global.logger.log('error',error);
    		setTimeout(tweet,60000);
  });
    stream.on('data', function(data) {
	if (!arrayMatch.some(function(v) { return data.text.indexOf(v) >= 0; })) {
    		return;
  	}

    	if (data.retweeted_status)
    		{
    		 data.retweeted_status._ts = new Date().getTime();
    	        doPost(data.retweeted_status);
    		}

    });
});
}

cleanup();
setInterval(cleanup,60000);
tweet();

module.exports = Tweet;
