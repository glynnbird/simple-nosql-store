var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var nosqldb = require('simplenosql')(process.env.COUCH_URL);
var cfenv = require('cfenv');
var compression = require('compression');
var appEnv = cfenv.getAppEnv();

// gzip responses
app.use(compression());

// parse POSTed and PUTed request bodies with application/json mime type
app.use(bodyParser.json({ limit: '1mb'}));

// or form-encoded parameters
app.use(bodyParser.urlencoded({ extended: true }));

// https://softinstigate.atlassian.net/wiki/display/RH/API+tutorial#APItutorial-CreateaDatabase

var isArray = function(v) {
  return (v && v.constructor === Array);
};

// send data back to the web client
var send = function(res) {
  return function(data) {
    res.send(data);
  }
};

// send error back to the web client
var errHandler = function(res) {
  return function(err) {
    var statusCode = err && err.statusCode || 400;
    var msg = err && err.error || undefined;
    var obj = {ok: false, msg: msg};
    res.status(err.statusCode).send(obj);
  }
};

// create a database
app.put('/:db', function(req, res) {
  nosqldb(req.params.db)
    .create()
    .then(send(res))
    .catch(errHandler(res));
});

// get summary of a database
app.get('/:db', function(req, res) {
  nosqldb(req.params.db)
    .info()
    .then(send(res))
    .catch(errHandler(res));
});

// create a collection - does nothing
app.put('/:db/:collection', function(req, res) {
  res.send({ ok: true });
});

// create a new document in a collection
app.post('/:db/:collection', function(req, res) {
  if (isArray(req.body)) {
    req.body.map(function(d) {
      if (d && typeof d === 'object') {
        d.collection = req.params.collection; 
      }
      return d;
    });
  } else {
    req.body.collection = req.params.collection; 
  }
  nosqldb(req.params.db)
    .insert(req.body)
    .then(send(res))
    .catch(errHandler(res));
});

// update a document in a collection
app.post('/:db/:collection/:id', function(req, res) {
  req.body.collection = req.params.collection; 
  nosqldb(req.params.db)
    .update(req.params.id, req.body)
    .then(send(res))
    .catch(errHandler(res));
});

// get all docments in a collection, or
// filter a collection
app.get('/:db/:collection', function(req, res) {
  var thiscollection = { collection: req.params.collection};
  if (req.query && Object.keys(req.query).length > 0) {
    req.query = { '$and': [
       thiscollection,
       req.query
    ]};
  } else {
    req.query = thiscollection;
  }
  nosqldb(req.params.db)
    .all(req.query)
    .then(send(res))
    .catch(errHandler(res));
});

// get a singe document from a collection
app.get('/:db/:collection/*', function (req, res) {
  var id = req.params[0];
  if (id.indexOf(',') > 0 ) {
    id = id.split(',');
  }
  nosqldb(req.params.db)
    .get(id)
    .then(send(res))
    .catch(errHandler(res));
});

// delete a document from a collection
app.delete('/:db/:collection/:id', function (req,res) {
  nosqldb(req.params.db)
    .del(req.params.id)
    .then(send(res))
    .catch(errHandler(res));
});


// get top-level details
app.get('/', function(req, res) {
  nosqldb()
    .list()
    .then(send(res))
    .catch(errHandler(res));
});

// Catch unknown paths
app.use(function(req, res, next) {
  res.status(400).send({ok: false, msg: 'unknown path'})
});

app.listen(appEnv.port, function () {
  console.log('Started on ' + appEnv.url)
})