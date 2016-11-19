var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var cloudant = require('cloudant')(process.env.COUCH_URL);
var hash = require('./lib/hash.js');
var utils = require('./lib/utils.js');

// parse POSTed and PUTed request bodies with application/json mime type
app.use(bodyParser.json({ limit: '1mb'}));

// or form-encoded parameters
app.use(bodyParser.urlencoded({ extended: true }));

// https://softinstigate.atlassian.net/wiki/display/RH/API+tutorial#APItutorial-CreateaDatabase

// create a database
app.put('/:db', function(req, res) {
  cloudant.db.create(req.params.db).pipe(res);
});

// create a collection
app.put('/:db/:collection', function(req, res) {
  var db = cloudant.db.use(req.params.db);
  var i = {name:'first-name', type:'json', index:{fields:['collection']}};
  db.index(i, function(er, response) {
    res.send({ ok: true });
  });
});

// create a new document in a collection
app.post('/:db/:collection', function(req, res) {
  var doc = req.body;
  var db = cloudant.db.use(req.params.db);
  
  // if array is supplied, do bulk insert
  if (utils.isArray(doc)) {
    doc.map(function(d) {
      d.collection = req.params.collection;
      d.ts = new Date().getTime();
      return d;
    });
    db.bulk({docs: doc}).pipe(res);
  } else {
    // single insert
    doc.collection = req.params.collection;
    doc.ts = new Date().getTime();
    db.insert(doc).pipe(res);
  }

});

// get all docments in a collection, or
// filter a collection
app.get('/:db/:collection', function(req, res) {
  var db = cloudant.db.use(req.params.db);
  if (Object.keys(req.query).length > 0) {
    var q = null;
    // ="{'name':'restheart'}"
    if (req.query.filter) {
      try {
        var q = JSON.parse(req.query.filter);
      } catch(e) {
        res.status(400).send({ok: false, msg: 'filter paramter is not JSON'});
      }
    }
    if (!q) {
      q = req.query;
    }
    var selector = { '$and': [ 
      {collection: req.params.collection},
      q ]};
    db.find({selector: selector}).pipe(res);
  } else {
    // all docs
    var selector = { collection: req.params.collection};
    db.find({selector: selector}).pipe(res);
  }
});

// get a singe document from a collection
app.get('/:db/:collection/:id', function (req, res) {
  var db = cloudant.db.use(req.params.db);
  db.get(req.params.id).pipe(res);
});

// delete a document from a collection
app.delete('/:db/:collection/:id', function (req,res) {
  var db = cloudant.db.use(req.params.db);
  db.get(req.params.id, function(err, data) {
    if (err) {
      return res.status(404).send({ok: false, msg: 'document does not exist'});
    }
    db.destroy(req.params.id, data._rev).pipe(res);
  })
});


app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})