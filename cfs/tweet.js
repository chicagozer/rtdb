var util = require('util'),
    twitter = require('twitter');
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

function doPost(data)
{

var userString = JSON.stringify(data);

var headers = {
  'Content-Type': 'application/json; charset=utf-8'
 };

var options = {
  host: 'localhost',
  port: 9001,
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

 global.logger.log('info', 'tweet - startup.');

twit.stream('statuses/filter', { language: 'en', track: 'php,nosql,jquery,nodejs,paas,clouddb,heroku,javascript,HTML5' }, function(stream) {
    stream.on('data', function(data) {
//	global.logger.log('info','tweet - got something');
    	if (data.retweeted_status)
    		{
    		 data.retweeted_status._ts = new Date().getTime();
    	        doPost(data.retweeted_status);
    		}

    });
});

module.exports = Tweet;
