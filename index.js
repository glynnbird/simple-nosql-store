var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var cloudant = require('cloudant')(process.env.COUCH_URL);
var async = require('async');
var cfenv = require('cfenv');
var appEnv = cfenv.getAppEnv();
var hash = require('./lib/hash.js');
var utils = require('./lib/utils.js');
var attempt = require('./lib/attempt.js');
var strip = require('./lib/strip.js');


// parse POSTed and PUTed request bodies with application/json mime type
app.use(bodyParser.json({ limit: '1mb'}));

// or form-encoded parameters
app.use(bodyParser.urlencoded({ extended: true }));

// https://softinstigate.atlassian.net/wiki/display/RH/API+tutorial#APItutorial-CreateaDatabase

// write output to client
var output = function(data, res) {
  if (utils.isArray(data)) {
    res.send(strip.arrayOfDocs(data));
  } else {
    res.send(strip.singleDoc(data));
  }
};

var multiCallback = function(res) {
  return function(err, data) {
    if (err) {
      return res.send(err.statusCode).send({ok: false, msg: err.error});
    }
    if (utils.isArray(data)) {
      output(data, res);
    } else if (utils.isArray(data.docs)) {
      output(data.docs, res);
    } else {
      res.send([]);
    }
  }
};

var singleCallback = function(res) {
  return function(err, data) {
    if (err) {
      return res.send(err.statusCode).send({ok: false, msg: err.error});
    }
    output(data, res);
  }
};

// create a database
app.put('/:db', function(req, res) {
  cloudant.db.create(req.params.db, function(err, data) {
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
});

// get summary of a database
app.get('/:db', function(req, res) {
  var db = cloudant.db.use(req.params.db);
  db.view('count', 'bycollection', {group:true}, function(err, data) {
    if (err) {
      return res.status(err.statusCode).send({ok: false, msg: err.error});
    }
    var retval = {};
    data.rows.forEach(function(r) {
      retval[r.key] = r.value;
    });
    res.send({ok:true, collections: retval});
  })
});

// create a collection - does nothing
app.put('/:db/:collection', function(req, res) {
  res.send({ ok: true });
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
    db.bulk({docs: doc}, multiCallback(res));
  } else {
    // single insert
    doc.collection = req.params.collection;
    doc.ts = new Date().getTime();
    db.insert(doc, singleCallback(res));
  }

});

// update a document in a collection
app.post('/:db/:collection/:id', function(req, res) {
  var doc = req.body;
  var db = cloudant.db.use(req.params.db);

  // if array is supplied, do bulk insert
  doc.collection = req.params.collection;
  doc.ts = new Date().getTime();
  attempt.update(cloudant, req.params.db, req.params.collection, req.params.id, doc, singleCallback(res));
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
    db.find({selector: selector}, multiCallback(res));
  } else {
    // all docs
    var selector = { collection: req.params.collection};
    db.find({selector: selector}, multiCallback(res));
  }
});

// get a singe document from a collection
app.get('/:db/:collection/*', function (req, res) {
  var db = cloudant.db.use(req.params.db);
  var ids = req.params[0].split(',');
  if (ids.length == 1) {
    db.get(ids[0], singleCallback(res));
  } else {
    db.list({keys:ids, include_docs: true}, function(err, data) {
      if (err) {
        return res.status(err.statusCode).send({ok: false, msg: err.error});
      }
      var retval = [];
      data.rows.forEach(function(r) {
        if (r.doc) {
          retval.push(r.doc);
        } else {
          retval.push({ _id: r.key, _error: r.error});
        }
      })
      output(retval, res);
    });
  }

});

// delete a document from a collection
app.delete('/:db/:collection/:id', function (req,res) {
  attempt.del(cloudant, req.params.db, req.params.collection, req.params.id, singleCallback(res));
});


// get top-level details
app.get('/', function(req, res) {
  cloudant.db.list(function(err, data) {
    if (err) {
      return res.send(err.statusCode).send({ok: false, msg: err.error});
    }
    data = data.filter(function(v) {
      return (v !== '_users' && v !== '_replicator');
    });
    output(data, res);
  })
});

// Catch unknown paths
app.use(function(req, res, next) {
  res.status(400).send({ok: false, msg: 'unknown path'})
});

app.listen(appEnv.port, function () {
  console.log('Started on ' + appEnv.url)
})