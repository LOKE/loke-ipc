'use strict';

var Communications = exports.Communications = require('./communications');

/**
 * Creates a new sumo communciations connection and starts it
 * @param  {String} [url|amqp://localhost] - The connection url, defaults to 'amqp://localhost'
 * @param  {Logger} [logger]  - optionally a custom logger can be provided. Must implement .debug, .info, .error, .warn
 * @return {Q.Promise}        - A promise that resolves with the connection if successful
 */
exports.connect = function (url, logger) {
  var comms = new Communications(url, logger);

  return comms.start()
  .then(function() {
    return comms;
  });
};
