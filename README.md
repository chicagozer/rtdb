# rtdb

© 2014 by Rheosoft. All rights reserved. 
Licensed under the [RTDB Software License version 1.0](/license.pdf).
 
Comments, questions? <info@rheosoft.com>

## Overview

**rtdb** is a real-time [JSON](http://www.json.org/) document database.
Data is made available via [map/reduce](http://en.wikipedia.org/wiki/MapReduce) queries.  
Queries are updated in real-time and subscribers are notified instantly as data is added.

The open source version of **rtdb** takes big data principles and extends into practical domain.
The map/reduce construct is applied in the real-time domain to provide a unique, live analytical view of data.  

Use **rtdb** and leave polling behind!

## Installing

* Clone the [git](http://git-scm.com/) repository (use --recursive!)

    git clone --recursive [https://github.com/chicagozer/rtdb.git](https://github.com/chicagozer/rtdb)  
    
* Then run *[npm](https://npmjs.org/) install*
    
    `cd rtdb`  
    `npm install`
    
## Usage

Launch **rtdb** with [node.js](http://http://nodejs.org/). Change your settings file param as desired.

node rtdb.js --settings settings/settings.json

## PaaS sites

Online demo versions are available.

[http://rtdb.herokuapp.com](http://rtdb.herokuapp.com)

[http://rtdb-rheosoft.rhcloud.com](http://rtdb-rheosoft.rhcloud.com)

## Acknowledgements

**rtdb** was inspired by and indebted to several projects.

Especially [couchdb](http://couchdb.apache.org/) and [node.js](http://nodejs.org/).

Thanks to [npm](https://npmjs.org/) and several excellent libraries. See package.json for more details. 

Some samples contain a freely licensed template from [MediaLoot](http://medialoot.com/item/html5-admin-template/).
## Web interface

When running locally, the main web interface is reachable at

[http://localhost:9001/web/](http://localhost:9001/web/)

The web interface provides the ability to manage collections, views and subscriptions. 

## Architecture

### Documents

**rtdb** is a [document-oriented database](https://en.wikipedia.org/wiki/Document-oriented_database). A document may be any JSON object. 

### Collections

Documents are organized into "Collections". A collection is a specific type of document. There is no requirement that all documents
be the same JSON format but it does help somewhat that all documents in a given collection have similar structures when designing queries.  

### Views

Each collection contains "Views". A View represents a particular query into the Collection. All queries must be "pre-registered".
There is no "ad-hoc" query facility. However, as the data changes, registered queries are run continuously and subscribers are updated in real-time.

### Subscriber

A "Subscriber" represents a party (usually a browser) interested in receiving updates when the query results change. A query may have many subscribers.
Subscribers are registered via HTML EventSources.

The hierarchy is straightforward.

Collections → Views → Subscribers  
 ↳ Documents

### Map/Reduce

The query within each view is implemented via map/reduce. Each query requires a map function and a reduce function.  
Optionally, a finalize function and a personalize function can be added.
For incoming documents, the pipeline follows this pattern.

Map → Reduce → Finalize → Personalize

#### Map  

The map function is called once for each incoming document. The purpose is to initially categorize the data
and it takes the following arguments.  

* item - *item* is the document to process. 
* emit - *emit* is a function that is called to *map* the item. 
* database - a reference to the database for accessing other collections/views.

*emit* takes two arguments.

	* key - the hash to store
	* value - the value to store

*emit* may be called one or more times for each call to map.

#### Reduce

Reduce is called once for each key *emitted* by *map*.  It takes the following arguments.

* values - an array of values to reduce
* rereduce - a boolean indicating if we are *rereducing*.
* emit - a function that is called to *emit* the result.
* database - a reference to the database for accessing other collections/views.

*emit* takes one argument, the result of the reduction. 
*emit* should be called no more than once per *reduce*.

**rtdb** uses the *re-reduce* approach to accomplish incremental map/reduce. The reduce function you supply must honor this flag.

>"[A] Reduce function has the requirement that not only must it be referentially transparent,
>but it must also be commutative and associative for the array value input,
>to be able reduce on its own output and get the same answer."  

> [Damien Katz](http://damienkatz.net/2008/02/incremental_map.html)

Therefore, again citing Damien, for a reduce function, 

     f(Key, Values) == f(Key, [ f(Key, Values) ] )

More discussion [here](http://wiki.apache.org/couchdb/Introduction_to_CouchDB_views#Reduce_vs_rereduce).

#### Finalize

The *finalize* function may be used to sort and/or cull the result set before sending to subscribers.
A common usage would be to sort and trim to a "top 10" list.

*finalize* takes the following arguments.

* reduction - an array of reduced values to *finalize*.
* emit - a function that is called to *emit* the result. Pass the *finalized* reduction.
* database - a reference to the database for accessing other collections/views.

#### Personalize.

The *personalize* function is similar to *finalize* however is it called separately for each subscriber.
The intent is to allow the function to use HTTP header values to identify the subscriber and personalize the resultset
specifically for the subscriber. A common usage would be to filter the data based on the user.

*personalize* takes the following arguments.

* reduction - an array of reduced values to *finalize*.
* headers - the HTTP headers of the current subscriber. See node.js [documentation](http://nodejs.org/api/http.html#http_message_headers). 
* emit - a function that is called to *emit* the result. Pass the *personalized* reduction.
* database - a reference to the database for accessing other collections/views.

## Security 

**rtdb** has very little inherent security. This is by design.  

**rtdb** is intended to be run behind a secure web server such as [Apache](http://httpd.apache.org/). 
Apache and other web servers provide facilities to apply granular URL based security to **rtdb**.
See advanced topic, securing **rtdb**.

"Out of the box", rtdb implements Basic Authentication security for the administration functions. 
The user/password are set via environmental variables **RTDBADMIN_USER** and **RTDBADMIN_PWD**. 
In a production environment where security has been delegated, the Basic Authentication may be disabled
by changing the settings json parameter **disableBasicAuth** to **true**.

If rtdb is used over the internet, be sure to secure the traffic with https if you intend to rely on basic authentication.

## REST API

**rtdb** uses a simple REST API to manage and interact with the database. (The web interface even uses this REST API behind the scenes.
Feel free to check out the HTML!)

The REST API speaks JSON and uses standard verbs.

`GET` - return a JSON object.  
`PUT` - update passing a JSON object.  
`DELETE` - delete object according to url.  
`POST` - insert JSON object or execute command according to URL.  

Each collection, view and subscriber is given a Globally Unique Identifier (GUID).
Using a GUID guarantees uniqueness of the individual objects and allows separate databases to be combined if needed.
The GUID is used to reference specific objects via the REST API.

The web interface is an easy way to familiarize yourself with the GUIDs.

### Operations on Collections  

`POST /db/collections` - Add a new Collection.  
`PUT /db/collections/[col_guid]` - Update Collection.  
`DELETE /db/collections/[col_guid]` - Delete Collection.  
`GET /db/collections` - List all collections.  
`GET /db/collections/[col_guid]` - List specific collection.  
`POST /db/collections[col_guid]/documents` - Add a Document or Array of Documents.  
`DELETE /db/collections/[col_guid]/documents` - Delete all Documents.  

### Operations on Views  

`POST /db/collections[col_guid]/views` - Add a new View.  
`PUT /db/collections/[col_guid]/views/[view_guid]` - Update View.  
`DELETE /db/collections/[col_guid]/views/[view_guid]` - Delete View.  
`GET /db/collections/[col_guid]/views` - List all Views.  
`GET /db/collections/[col_guid]/views/[view_guid]` - List View.  
`GET /db/collections/[col_guid]/views/[view_guid]/ticket` - fetch security ticket. 
`GET /db/collections/[col_guid]/views/[view_guid]/subscribers` - List subscribers.  
`GET /db/collections/[col_guid]/views/[view_guid]/reduction` - List query result.  

### Miscellaneous Operations

`GET /db/stream?view=[guid]` - Used by EventSource. Multiple view params are supported.  
`GET /db/admin/stats` - Show database stats in JSON.  
`POST /db/admin/stop` - Shutdown the database.  

## Using rtdb

Steps for using **rtdb** are:

1. Use the web interface or REST API to create a collection.
2. Create one or more views for the collection.
3. Subscribers will register for queries via WebSocket or Server Sent Event API.
4. Insert new JSON documents via the REST API. 
5. Subscribers receive updates as documents are inserted.

You may use the REST API to insert documents. An example CURL syntax to load a file *mydoc.json* would be 

    curl -X POST -H 'Content-Type: application/json' -d @mydoc.json http://localhost:9001/db/collections/[col_guid]/documents

Note that for inserts, the **rtdb** REST API expects either a single JSON document or array of documents.
To maximize performance, the map/reduce is run once for the entire array.
So use arrays when inserting multiple documents at once.

Browser subscribers register for streams via the [HTML5 event source API](http://www.w3.org/TR/eventsource/) or [WebSockets](http://www.w3.org/TR/websockets/).  

### Server Sent Events (EventSources)

EventSources provide a mechanism for the database to push updates to subscribers (usually a browser).
This eliminates the need for clients to poll the database checking for updates. The heart of **rtdb** is the ability
to send aggregations to subscribers in real-time.

Often a browser client may want to show multiple views on a single page. Intuitively a subscriber would create an EventSource for each interesting view. However in practice, web browsers
limit the number of active EventSources to a very small number.
Instead of creating multiple EventSources, supply multiple view params for each additional stream.
Most browsers have a limit on the number of EventSources that may be created per page.
With this technique there is no limit to the number of subscriptions.  

When adding the EventListener, pass the GUID of each view as a param.

    var source = new EventSource(
	    "/db/stream?view=6f57030d-ccad-41df-aa92-689292fa2c42&view=ec537999-60a5-41f3-9036-fcd3d5356ae2");
				
    source.addEventListener("6f57030d-ccad-41df-aa92-689292fa2c42", function(event) {
	    console.log(event.data);
	    }, false);
	
    source.addEventListener("ec537999-60a5-41f3-9036-fcd3d5356ae2", function(event) {
	    console.log(event.data);
	    }, false);
	    
### Securing Subscriptions

**rtdb** provides a ticket based security model. ACL based security is enabled via the settings.json by setting
**useACLTicket** to **true**. In this case, a ticket must be retrieved for each view via a REST call.

	/db/collections/[col_id]/views/[view_guid]/ticket
	
The "ticket" provides the proper authorization to initiate the subscription. This pattern is in place so that an upstream
ACL security mechanism can check the URL and do the authentication.
Since collections and views have unique GUIDs, access to the resource
can be secured at a granular level.

Tickets are passed to the EventSource as a param. If more than one view is required, pass multiple view and ticket params.

    var source = new EventSource(
	    "/db/stream?view=6f57030d-ccad-41df-aa92-689292fa2c42&ticket=" + ticket);
	    
The ticket has a short expiration (less than one minute) so that it may not be cached or passed around. It should be used once
immediately after requesting it. 
	    
### WebSockets

Subscriber data only flows in a single direction in **rtdb**. Therefore Server Sent Events are
an excellent choice for a transport. It is more widely supported in PaaS environments and may behave better with proxies.
However in some cases, WebSockets are preferable and may even be required to support certain browsers such as Internet
Explorer.

**rtdb** uses the excellent socket.io package for WebSocket support. The connection steps are as follows. 

First secure a ticket for the view or views if ACL security is enabled. This process is identical to using Server Sent Events.
	
Once the ticket is secured the socket is created.

    var view, var ticket; 
    var socket = io.connect(); 

In the socket connect event, we use **emit** to call the server and "subscribe" to the view, passing the ticket.
If you are subscribing to multiple views, pass an array of view/ticket JSON objects.

    socket.on('connect', function () {
      socket.emit('subscribe', { ticket: ticket, view: view });
      
      socket.on(view,
         function(data) {
         ...do something with data...
         }
         );
      });

The demos discussed below serve as references for a complete implementation.
      	    
## Demos

**rtdb** comes with two sample collections and a web front-end accessible at

[http://localhost:9001/demo/apples](http://localhost:9001/demo/apples)

[http://localhost:9001/demo/parcels](http://localhost:9001/demo/parcels)

These two demos utilize Server Sent Events to receive real-time updates. Documents are added through the REST API. 

The "Apples" demo provides a simple front end for adding new documents and viewing the aggregations.
It is more interesting when running simultaneously on multiple browsers.

The "Parcels" demo uses a small sample of public domain property tax parcel data and inserts documents
repeatedly to provide constantly updating aggregations. The inserts are initiated by cfs/parcels.js.
Be sure to remove or move this file in a production environment.

An online connection is required to load the Google libraries used for charting.

Also included are mobile versions of the demos. Accessible via the menu or loaded by default
if accessing the demo from a mobile platform.

### Websocket Demos

Additional samples have been provided illustrating Websocket support.

[http://localhost:9001/demo/applesws](http://localhost:9001/demo/applesws)

[http://localhost:9001/demo/parcelsws](http://localhost:9001/demo/parcelsws)

## Advanced Topics

### rtdb files and directories

Here is a summary of the **rtdb** project file structure.  

	 /package.json - packaging file for NPM  
	 /README.md - this file   
	 /rtdb.js - the main class  
	 /collection.js - collection class  
	 /identity.js - helper class for guid identity  
	 /view.js - view class  
	 /db.js - database class
	 /license.pdf - the license  
	 /cfs - the pluggable file systems  
	 	/cfslocal.js - local file storage  
	 	/cfss3.js - Amazon S3 storage  
	 	/parcels.js - loader for parcel demo. 
	 node_modules - required Node modules installed by NPM
	 /public - static files served by the web server  
	 /settings - startup options in JSON format  
	    /settings.json - basic settings  
	    /mocha.json - settings for running mocha tests  
	 /test - mocha tests  
	 /views - Jade templates used by the web interface
	 /sampledb - the sample collections used by the demos  

There are two default settings files in /settings

settings.json - a basic startup settings file. It will run the demo database provided
in the sampledb subdirectory.  
mocha.json - used for [mocha](http://visionmedia.github.io/mocha/) testing. Note, to run all the mocha tests, provide valid S3 connection params in this file.  

### Database file structure

The database is a hierarchy of JSON files. Each JSON file is uniquely named [guid].json. 
Where [guid] is the GUID assigned to the object.  

`/collections` - contains one file for each collection in format [col_guid].json  
`/collection/[col_guid]/documents` - contains one json file per document.  
`/collection/[col_guid]/views` - contains one file for each view in format [view_guid].json  
`/collection/[col_guid]/view/[view_guid]/reduction` - for "transient" collections, each reduction is saved at shutdown.  

### Securing rtdb

**rtdb** is designed to work with standard web-based security mechanisms.  

User and group authentication should be considered for any production deployment.

The REST API may be secured by specific URL to limit or control access at the collection or view level.  

In production environments, admin functions should be secured by method and URL.

### Collection attributes

There are several attributes on a collection worth mentioning.

#### Document Expirations

A collection may be given an document *expiration* in milliseconds.
This can be useful for implementing queries based on sliding windows. (i.e. trends for the last hour, last day, etc).  
If you only want the last hour's worth of data, set the expiration to 3600000.
The views associated with the collection will be automatically map/reduced when the expiration is triggered.  

Note, the *expiration* value is used to signal when to map/reduce.
It is expected that the persistence provider perform the actual removal of the stale documents. 
In the case of the local filesystem CFS, an external task, such as a cron entry, should be used to delete stale files.

To illustrate the sequence, here is an example.

10:05am - insert 5 documents; assume expiration is 3660 secs. (1 hour + 1 minute)  
11:05am - cron runs, deleting all files older than 60 mins.   
11:06am - expiration timer will fire; collection will be map/reduced. Documents added at 10:05 will have fallen off.  

Using *expiration* can be expensive. As each batch of documents expires, the full collection must be map-reduced.
*Expiration* will ensure the collection is map-reduced the minimum number of times required.. 
However, if you are inserting large volumes of documents, consider simply forcing a map-reduce via the REST API on a regular interval instead.

If you are concerned about the expense of performing a full map-reduce, 
consider simply clearing the collection on a timed interval. 
The effect is a bit different than a sliding window, but very efficient.

#### Using Transient  

When a collection is marked as *transient*, collections are reduced, but documents are not persisted.
This can be useful for high volume or when the data is persisted elsewhere.  

One caveat is that when new views are added to a collection,
the reduction can only happen on "new" documents.

Reductions are persisted when the database is shutdown so that current state of reductions are preserved when the database is restarted.

Note that collections that use *expiration* cannot use *transient*.
These two flags are mutually exclusive.  

#### Using Priority 

When a collection will be used for lookups (aka master tables), it must be loaded before its dependent collections.  
Use the *Priority* to order how collections are loaded. Lower numbers are loaded first.

### Using Deltas

Often the amount of data that changes between events is small compared to the overall size of the reduction.
RTDB offers a form of compression for this case and sends just the difference between the last reduction and latest one.

This mode is enabled by passing the query parm *delta* when subscribing to a stream. i.e.  

    /db/stream?view=6f57030d-ccad-41df-aa92-689292fa2c42&delta=true
    
Or in the case of a WebSocket, send 

	delta: true
	
in the subscription event.
    
In *delta* mode **rtdb** will first send a full JSON reduction, then all subsequent updates will be *diffs*.
The [symmetry](https://github.com/Two-Screen/symmetry) Javascript library may be used to patch the reduction with the latest diff.

    var reduction = Symmetry.patch(lastreduction,JSON.parse(event.data));  
    
A *delta* version of the demo may be found [here](http://localhost:9001/demo/apples_delta).
    
Use *delta* mode when the overall size of the reduction is large compared to the amount of incremental change.
However, depending on the view, using delta mode may be less efficient than sending the full reduction.

### Referencing other Collections in a Query

Unlike a relational database, there is no *join* syntax to combine collections.
However the database object is passed to the map/reduce methods and 
this can be useful for referencing other collections when a lookup is required. 
You will need to provide a "lookup" reduction on the collection containing the master data.

    // myobject will contain the key used for the lookup
    var myobject;
    // Use a GUID to get a reference to the collection containing master data
    var c=database.collectionAt('be2aec31-3d1d-4674-bc20-106d5c46e220'); 
    // Use a GUID to get the intended view
    var v = c.viewAt('e3ef472a-1f7e-469e-98f9-cf759cc05352'); 
    // do the lookup by using "myobject" as the hash
    var r = v.reductionAt(myobject);
    // use the return value "r" as needed.

### IPv6

**rtdb** supports IPv6. Supply an IPv6 listen address for **hosts** in the settings json.

	"hosts": ["::1"]

This field takes an array so you may supply both an IPv4 address and IPv6 if desired.

    "hosts": ["::1","localhost"]
    
If you wish to use the parcels demo with IPv6, you will need to update the hosts value in **parcels.js**.

### Settings

The settings json file is the mechanism to supply database parameters.

	hosts: an array of hosts to listen on. May be IPv4 or IPv6.
	port: The port to listen on.
	useACLTicket: boolean to enable the ACL/ticket security mechanism.
	disableBasicAuth: boolean to disable basic authentication for DB admin functions.
	cfs: the persistence layer to use.
	cfsinit: json object passed to persistence layer for initialization params.
	reduceInterval: minimum interval between subscriber updates.
	expirationInterval: expiration interval for transient collections.

### Jade

The jade templating engine is used for the web administration and the demos. 
The templates are contained in the /views subdirectory. Templates may be added or modified dynamically.
(i.e. no need to restart rtdb.)

### Licensing

**rtdb** is licensed under the [RTDB Software License version 1.0](/license.pdf).
Commercial licenses and support are also available @<info@rheosoft.com>.

### Custom Persistence

**rtdb** uses a plugin architecture for persistence. A local filesystem (cfslocal) implementation and Amazon S3 (cfss3) are provided.  
To add your own provider, implement these methods for your provider and install 
the javascript module into the /cfs subdirectory. 
You may use either *cfslocal.js* or *cfss3.js* as a template.

    function name()  - return a unique name for this provider
    function init(parms)  - initialize with params from settings.json
    function exists(dir, callback)  - does this exist? 
    function get(key, callback)  - return object by key
    function del(key, callback)   - delete object by key
    function put(prefix, item, callback, expires)   - put object
    function list(prefix, callback)  - list objects
    
## cfslocal

*cfslocal* is the default persistence layer. Database objects are writen to the local file system.
The *cfslocal* persistence layer takes a single initialization param.

	"root" : "sampledb/"

Set this value to to the location of the local directory to contain the database files.

## cfss3

*cfss3* allows writing to the Amazon S3 file system. Supply your credentials accordingly in the settings json.

	"config" : { "accessKeyId" : "xxx", 
		"secretAccessKey": "xxx", 
		"region": "us-east-1" 
			},
	"params" : {
		"Bucket" : "xxxxxx"
		}
