var async = require('async');

var del = function(cloudant, dbname, collection, id, callback) {
  var db = cloudant.db.use(dbname);

  // fetch document to get rev token
  var fetchAndDelete = function(done) {
    db.get(id, function(err, data) {
      if (err) {
        return done({ok: false, msg: 'document does not exist', statusCode: 404});
      }
      db.destroy(id, data._rev, function(err, data) {
        if (err) {
          return done({ok: false, msg: err.msg, statusCode: err.statusCode});
        }
        done(null, {ok: true});
      });
    });
  };

  async.retry({
    times: 3,
    interval: function(retryCount) {
      return 50 * Math.pow(2, retryCount);
    }
  }, fetchAndDelete, function(err, result) {
    callback(err, result);
  });
};



module.exports = {
  del: del
}