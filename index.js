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
  nosqldb(req.params.db)
    .collection(req.params.collection)
    .insert(req.body)
    .then(send(res))
    .catch(errHandler(res));
});

// update a document in a collection
app.post('/:db/:collection/:id', function(req, res) {
  nosqldb(req.params.db)
    .collection(req.params.collection)
    .update(req.params.id, req.body)
    .then(send(res))
    .catch(errHandler(res));
});

// get all docments in a collection, or
// filter a collection
app.get('/:db/:collection', function(req, res) {
  nosqldb(req.params.db)
    .collection(req.params.collection)
    .all(req.query)
    .then(send(res))
    .catch(errHandler(res));
});

// get a singe document from a collection
app.get('/:db/:collection/*', function (req, res) {
  nosqldb(req.params.db)
    .collection(req.params.collection)
    .get(req.params[0])
    .then(send(res))
    .catch(errHandler(res));
});

// delete a document from a collection
app.delete('/:db/:collection/:id', function (req,res) {
  nosqldb(req.params.db)
    .collection(req.params.collection)
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