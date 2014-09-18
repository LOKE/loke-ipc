var Q = require('q');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var guid = require('node-uuid').v4;
var commUtil = require('../util');

var domain = require('domain');

var EXCHANGE = 'pubsub';

function Subscription(routingKey, options, handler) {
  this.routingKey = routingKey;
  this.handler = handler;
  this.subscriber = options.subscriber;
  this.regexp = options.regexp;
}

Subscription.prototype.destroy = function () {
  this.subscriber.unsubscribe(this);
};

Subscription.prototype.handleMessage = function (routingKey, content) {
  if (this.regexp && !this.regexp.test(routingKey)) {
    return;
  }
  this.handler(routingKey, content);
};

function createPatternRegex (routingKey) {
  var rstring = routingKey
  .replace(/\./g,'\\.')
  .replace(/\*/g,'[^\\.]+')
  .replace(/#/g,'.+');

  return new RegExp('^' + rstring + '$');
}


function Subscriber () {
  this._patterns = [];
  this._exactKeys = {};
}

util.inherits(Subscriber, EventEmitter);

exports.Subscriber = Subscriber;

// Sets up the temporary socket that emits the response and connected events
Subscriber.prototype.setupSocket = function (comm) {
  var self = this;

  return comm.getChannel()
  .then(function (ch) {
    self.ch = ch;
    return ch.assertQueue(commUtil.getUniqueQueueName('subscriptions'), {
      exclusive: true,
      autoDelete: true,
      durable: false
    });
  })
  .then(function (ok) {
    self.queueName = ok.queue;
    self.ch.consume(self.queueName, function(msg) {
      var d = domain.create();
      d.cid = msg.properties.correlationId || guid();

      d.run(function () {
        self._handleMsg(msg);
      });

      d.on('error', function (err) {
        console.error('BAD REQUEST ERROR:', err.message);
        self.handleResponse(msg, self.jsonRPCError(null, err));
        d.dispose();
      });
    }, {noAck:true, exclusive:true});
  });
};


Subscriber.prototype.closeSocket = function () {

};


Subscriber.prototype.subscribe = function (routingKey, handler) {
  var self = this;

  var subscription = new Subscription(
    routingKey,
    { subscriber: this },
    handler
  );

  // Check if key is a pattern
  if (/[\*#]/.test(routingKey)) {
    subscription.regexp = createPatternRegex(routingKey);
    self._patterns.push(subscription);
  } else {
    if (!self._exactKeys[routingKey]) {
      self._exactKeys[routingKey] = [];
    }
    self._exactKeys[routingKey].push(subscription);
  }

  return self._bindQueue(routingKey)
  .thenResolve(subscription);;
};

Subscriber.prototype._bindQueue = function(routingKey) {
  var self = this;

  return Q.when(self.ch.assertExchange(EXCHANGE, 'topic', {
    durable: false,
    autoDelete: false
  })
  .then(function(ok) {
    return self.ch.bindQueue(self.queueName, EXCHANGE, routingKey);
  }));
};

Subscriber.prototype._unbindQueue = function(routingKey) {
  return Q.when(self.ch.assertExchange(EXCHANGE, 'topic', {
    durable: false,
    autoDelete: false
  })
  .then(function(ok) {
    return self.ch.unbindQueue(self.queueName, EXCHANGE, routingKey);
  }));
};


Subscriber.prototype.unsubscribe = function (subscription) {
  var self = this;

  self._patterns = self._patterns.filter(function (sub) {
    return sub !== subscription;
  });


  if (subscription.routingKey in self._exactKeys) {
    var arr = self._exactKeys[subscription.routingKey].filter(function (sub) {
      return sub !== subscription;
    });

    self._exactKeys[subscription.routingKey] = arr;
  }

  return self._unbindQueue(subscription.routingKey);
};

Subscriber.prototype._handleMsg = function (msg) {
  var self = this;

  var content = JSON.parse(msg.content.toString());
  var routingKey = msg.fields.routingKey;

  if (routingKey in self._exactKeys) {
    self._exactKeys[routingKey].forEach(function (subscription) {
      subscription.handleMessage(routingKey, content);
    });
  }

  self._patterns.forEach(function (subscription) {
    subscription.handleMessage(routingKey, content);
  });


  self.emit('message', routingKey, content);
};
