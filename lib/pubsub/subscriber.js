var Q = require('q');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var guid = require('uuid/v4');
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
  return this.subscriber.unsubscribe(this);
};

Subscription.prototype.handleMessage = function (routingKey, content) {
  if (this.regexp && !this.regexp.test(routingKey)) {
    return;
  }
  this.handler(routingKey, content);
};

function createPatternRegex (routingKey) {
  var rstring = routingKey
  .replace(/\./g, '\\.')
  .replace(/\*/g, '[^\\.]+')
  .replace(/#/g, '.+');

  return new RegExp('^' + rstring + '$');
}

function isPattern(routingKey) {
  return /[*#]/.test(routingKey);
}

function Subscriber (logger) {
  this._logger = logger;
  this._patterns = [];
  this._exactKeys = {};
  this._keycount = {};
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
    self.ch.consume(self.queueName, self._msgHandler.bind(self), {noAck: true, exclusive: true});
  });
};

Subscriber.prototype._msgHandler = function (msg) {
  var self = this;
  var d = domain.create();
  d.cid = msg.properties.correlationId || guid();

  d.run(function () {
    self._handleMsg(msg);
  });

  d.on('error', function (err) {
    // comm.reportError('BAD REQUEST ERROR: ' + err.message, err);
    self.handleResponse(msg, self.jsonRPCError(null, err));
    d.dispose();
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
  if (isPattern(routingKey)) {
    subscription.regexp = createPatternRegex(routingKey);
    self._patterns.push(subscription);
  } else {
    if (!self._exactKeys[routingKey]) {
      self._exactKeys[routingKey] = [];
    }
    self._exactKeys[routingKey].push(subscription);
  }

  if (!self._keycount[routingKey]) {
    self._keycount[routingKey] = 0;
  }


  return self._bindQueue(routingKey)
  .then(function () {
    self._keycount[routingKey] += 1;
    subscription.bound = true;
  })
  .thenResolve(subscription);
};

Subscriber.prototype.subscribeOnce = function (routingKey, handler) {
  var self = this;

  return self.subscribe(routingKey, function(routingKey, content) {
    // `this` in this context refers to the Subscription not Subscriber
    handler.bind(this)(routingKey, content);
    this.destroy();
  });
};

Subscriber.prototype._bindQueue = function(routingKey) {
  return Q.when(this.ch.assertExchange(EXCHANGE, 'topic', {
    durable: false,
    autoDelete: false
  })
  .then(() => {
    return this.ch.bindQueue(this.queueName, EXCHANGE, routingKey);
  }));
};

Subscriber.prototype._unbindQueue = function(routingKey) {
  return Q.when(this.ch.assertExchange(EXCHANGE, 'topic', {
    durable: false,
    autoDelete: false
  })
  .then(() => {
    return this.ch.unbindQueue(this.queueName, EXCHANGE, routingKey);
  }))
  .fail((reason) => {
    this._logger.warn('failed to unbind queue', reason);
  });
};

Subscriber.prototype._unbindSubscription = function(subscription) {
  var self = this;

  if (!subscription.bound) {
    return Q.when();
  }

  self._keycount[subscription.routingKey] -= 1;
  subscription.bound = false;

  if (self._keycount[subscription.routingKey] === 0) {
    return self._unbindQueue(subscription.routingKey);
  } else {
    return Q.when();
  }
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

  return self._unbindSubscription(subscription);
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
