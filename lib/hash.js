'use strict';

var crypto = require('crypto');

// calculate sha1 of string
var sha1 = function(string) {
  return crypto.createHash('sha1').update(string).digest('hex');
};

module.exports = {
  sha1: sha1
};