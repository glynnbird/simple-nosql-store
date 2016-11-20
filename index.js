var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var cloudant = require('cloudant')(process.env.COUCH_URL);
var async = require('async');
var hash = require('./lib/hash.js');
var utils = require('./lib/utils.js');
var attempt = require('./lib/attempt.js');

// parse POSTed and PUTed request bodies with application/json mime type
app.use(bodyParser.json({ limit: '1mb'}));

// or form-encoded parameters
app.use(bodyParser.urlencoded({ extended: true }));

// https://softinstigate.atlassian.net/wiki/display/RH/API+tutorial#APItutorial-CreateaDatabase

// create a database
app.put('/:db', function(req, res) {
  cloudant.db.create(req.params.db).pipe(res);
});

// get summary of a database
app.get('/:db', function(req, res) {
  var db = cloudant.db.use(req.params.db);
  db.view('count', 'bycollection', {group:true}, function(err, data) {
    if (err) {
      return res.send(err.statusCode).send({ok: false, msg: err.msg});
    }
    var retval = {};
    data.rows.forEach(function(r) {
      retval[r.key] = r.value;
    });
    res.send({ok:true, collections: retval});
  })
});

// create a collection
app.put('/:db/:collection', function(req, res) {
  var db = cloudant.db.use(req.params.db);
  async.parallel([
    // index the database by collection
    function(done) {
      var i = {type:'json', index:{fields:['collection']}};
      db.index(i, done);
    },
    // index everything
    function(done) {
      var i = { type: 'text', index: {}};
      db.index(i, done);
    },
    // count by collection
    function(done) {
      var map = function(doc) {
        if (doc.collection) {
          emit(doc.collection, null);
        }
      };
      var ddoc = {
        _id: '_design/count',
        views: {
          bycollection: {
            map: map.toString(),
            reduce: '_count'
          }
        }
      };
      db.insert(ddoc, done);
    }
  ], function(err, results) {
    res.send({ ok: true });
  })

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
    if (req.query._filter) {
      try {
        var q = JSON.parse(req.query._filter);
      } catch(e) {
        res.status(400).send({ok: false, msg: '_filter paramter is not JSON'});
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
app.get('/:db/:collection/*', function (req, res) {
  var db = cloudant.db.use(req.params.db);
  var ids = req.params[0].split(',');
  if (ids.length == 1) {
    db.get(ids[0]).pipe(res);
  } else {
    db.list({keys:ids, include_docs: true}, function(err, data) {
      if (err) {
        return res.status(err.statusCode).send({ok: false, msg: err.msg});
      }
      var retval = [];
      data.rows.forEach(function(r) {
        if (r.doc) {
          retval.push(r.doc);
        } else {
          retval.push({ _id: r.key, _error: r.error});
        }
      })
      res.send(retval);
    });
  }

});

// delete a document from a collection
app.delete('/:db/:collection/:id', function (req,res) {
  attempt.del(cloudant, req.params.db, req.params.collection, req.params.id, function(err, data) {
    if (err) {
      return res.status(err.statusCode).send(err);
    }
    res.send(data);
  });
});


app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})