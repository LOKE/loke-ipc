var ipc = require('../../lib');
var Q = require('q');
var config = require('./config');
var logger = require('./logger');

module.exports = function (fn) {
  var commsPromise = Q.when(ipc.connect(config.amqpuri, logger));

  return commsPromise.then(fn)
  .finally(function() {
    return commsPromise.then(function(comms) {
      return comms.stop();
    });
  });
};
