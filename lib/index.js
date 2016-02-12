var Communications = exports.Communications = require('./communications');

/**
 * Creates a new sumo communciations connection and starts it
 * @param  {Object} [options] - options
 * @param  {ILogger} [options.logger] - the logger to use
 * @param  {string} [options.amqpUri] - the AMQP URI to connect to. defaults to localhost.
 * @param  {Object} [options.newRelic] - new relic instance that will be used for tracing if provided
 * @return {Q.Promise}        - A promise that resolves with the connection if successful
 */
exports.connect = function (options) {
  var comms = new Communications(options);

  return comms.start()
  .then(function() {
    return comms;
  });
};
