var guid = require('uuid/v4');

var EXCHANGE = 'pubsub';

function Publisher (servicePrefix) {
  this.servicePrefix = servicePrefix;
}

exports.Publisher = Publisher;

// Sets up the temporary socket that emits the reponse and connected events
// @TODO: allow for custom exchange instead of just aston-exchange here
Publisher.prototype.setupSocket = function (comm) {
  var self = this;

  return comm.getChannel()
  .then(function (ch) {
    self.ch = ch;

    return self.ch.assertExchange(EXCHANGE, 'topic', {
      durable: false,
      autoDelete: false
    });
  });
};

/**
 * Execute RPC call and return promise that resolves to result or error.
 * @param {string} event - event name
 * @param {object} message - message data to send
 * @param {?object} options - publish options
 * @param {?string} options.correlationId - Correlation ID to attach to message. Will use message ID if not provided.
 * @param {?string} options.appId - Arbitrary app ID to attach to the message. Will use servicePrefix if not provided.
 * @param {?string} options.type - Arbitrary message type. Can be used to assist subscriber in deserialising the content.
 * @param {?Date} options.timestamp - Specified time of the event if in the past. Else current time will be used.
 */
Publisher.prototype.publish = function (event, message, options = {}) {
  const ch = this.ch;

  const domain = process.domain;
  const messageId = guid();
  let correlationId;

  if (options.correlationId) {
    correlationId = options.correlationId;
  } else if (domain && domain.cid) {
    correlationId = domain.cid;
  } else {
    correlationId = messageId;
  }

  const appId = options.appId || this.servicePrefix;
  const timestamp = options.timestamp
    ? options.timestamp.getTime()
    : new Date().getTime();

  var publishOptions = {
    correlationId,
    messageId,
    appId,
    timestamp,
    type: options.type,
    // headers: {},
    contentType: 'application/json',
    mandatory: false
  };

  var chunk = Buffer.from(JSON.stringify(message));

  return ch.publish(
    EXCHANGE,
    this.servicePrefix + '.' + event,
    chunk,
    publishOptions
  );
};
