var guid = require('node-uuid').v4;

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


// Execute RPC call and return promise that resolves to result or error.
Publisher.prototype.publish = function (event, message) {
  var ch = this.ch;

  var domain = process.domain;
  var cid;

  if (domain && domain.cid) {
    cid = domain.cid;
  } else {
    cid = guid();
  }

  var options = {
    correlationId: cid
  };

  var chunk = new Buffer(JSON.stringify(message));

  return ch.publish(
    EXCHANGE,
    this.servicePrefix + '.' + event,
    chunk,
    options
  );
};
