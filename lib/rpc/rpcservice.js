var Q = require('q');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var rpcmethod = require('./rpcmethod');
var domain = require('domain');
var guid = require('node-uuid').v4;

// Wraps the request callbacks, sockets and emitters into a nice interface.
// Create it, then call repond in the callback for a reply
// For a request, create it and then just call request
// Holds REQ sockets. REP sockets managed by main Communications class
function RpcService (serviceName, version, meta, logger) {
  if (!serviceName) {
    throw new Error('Cannot create service, no serviceName');
  }

  this._logger = logger;
  this.name = serviceName;
  this.version = version || 0;
  this.methods = {};
  this.isMeta = meta === true;
  var queueTail = this.isMeta ? 'meta' : 'request';

  this._closed = false;
  this._stopDeffered = Q.defer();
  this._pendingRequests = 0;

  this.queueName = util.format('%s-%d-%s', this.name, this.version, queueTail);
}

util.inherits(RpcService, EventEmitter);

exports.RpcService = RpcService;

function formatLogMsg(rpc) {
  var req = rpc.request;
  var res = rpc.response;

  if (res.error) {
    if (req) {
      return util.format('Rpc error: %s%s >!> Error: %s', req.method, JSON.stringify(req.params), res.error.message);
    } else {
      return util.format('Rpc request error: ??? >!> Error: %s', res.error.message);
    }
  } else {
    return util.format('Rpc: %s%s >>> %s', req.method, JSON.stringify(req.params), JSON.stringify(res.result));
  }
}

// return promise that resolves with what's emitted by respond
RpcService.prototype.setupSocket = function (comm) {
  var self = this;

  return comm.getChannel()
  .then(function (ch) {
    self.ch = ch;
    return ch.assertQueue(self.queueName, {durable: false});
  })
  .then(function (ok) {
    return self.ch.consume(self.queueName, function(msg) {
      self._msgHandler(msg);
    });
  })
  .then(function (ok) {
    self._consumerTag = ok.consumerTag;
  });
};

RpcService.prototype._logRpc = function(rpc) {
  if (!this._logger) { return; }
  var log = formatLogMsg(rpc);

  if (rpc.response.error) {
    this._logger.warn(log, rpc);
  } else {
    this._logger.debug(log, rpc);
  }
};

RpcService.prototype._msgHandler = function (msg) {
  var self = this;
  var d = domain.create();
  d.cid = msg.properties.correlationId || guid();

  d.run(function () {
    self._countUp();
    self._handleMsg(msg)
    .then(function() {
      self._countDown();
    })
    .done();
  });

  d.on('error', function (err) {
    if (self._logger) {
      self._logger.error('BAD REQUEST ERROR: ' + err.message + '\n' + err.stack, err);
    }
    d.dispose();
  });
};

RpcService.prototype._countUp = function () {
  this._pendingRequests++;
};

RpcService.prototype._countDown = function () {
  this._pendingRequests--;

  if (this._closed && this._pendingRequests <= 0) {
    this._stopDeffered.resolve();
  }
};


RpcService.prototype._handleMsg = function(msg) {
  var self = this;


  return Q.try(function () {
    return JSON.parse(msg.content.toString());
  })
  .fail(function (err) {
    err.code = -32700;
    throw err;
  })
  .then(function (request) {
    return self._handleRequest(request);
  })
  .fail(function (err) {
    return {
      request: null,
      response: rpcmethod.formatError(null, err)
    };
  })
  .then(function (rpc) {
    return self._handleResponse(msg, rpc.response)
    .then(function () {
      return self._logRpc(rpc);
    });
  });
};

RpcService.prototype.close = function() {
  var self = this;

  return self.ch.cancel(self._consumerTag)
  .then(function () {
    self._closed = true;

    if (self._pendingRequests <= 0) {
      self._stopDeffered.resolve();
    }

    return self._stopDeffered.promise;
  });
};


RpcService.prototype.exposeMethod = function (methodName, listener, timeout) {
  this.methods[methodName] = new rpcmethod.RpcMethod(null, listener, timeout);
};

RpcService.prototype.exposeServiceMethod = function (service, methodName) {
  if (typeof service[methodName] !== 'function') {
    throw new Error('Service ' + service, ' has no method ' + methodName);
  }

  var timeout = service[methodName].$timeout || 1000;

  this.methods[methodName] = rpcmethod.createFromServiceMethod(service, methodName, timeout);
};

RpcService.prototype._handleRequest = function (request) {
  var self = this;

  return self.methods[request.method].execRequest(request)
  .then(function(response) {
    return {
      request: request,
      response: response
    };
  });
};

RpcService.prototype._handleResponse = function (msg, response) {
  var self = this;

  var replyTo = msg.properties.replyTo;
  var options = {
    deliveryMode: true,
    correlationId: process.domain && process.domain.cid || guid()
  };

  var chunk = new Buffer(JSON.stringify(response));
  var pushed = self.ch.sendToQueue(replyTo, chunk, options);

  return Q.Promise(function (resolve) {
    if (!pushed) {
      if (self._logger) { self._logger.warn('RPC RESPONSE BUFFERED'); }
      self.ch.once('drain', resolve);
    } else {
      resolve();
    }
  })
  .then(function () {
    self.ch.ack(msg);
  });
};

RpcService.prototype.getMeta = function () {
  var self = this;

  var interfaces = Object.keys(self.methods).map(function (methodName) {
    return {
      methodName: methodName,
      methodTimeout: self.methods[methodName].timeout,
      paramNames: self.methods[methodName].paramNames
    };
  });

  return {
    version: self.version,
    serviceName: self.name,
    dateExposed: new Date(),
    interfaces: interfaces
  };
};


// -32700  Parse error Invalid JSON was received by the server.
// An error occurred on the server while parsing the JSON text.
// -32600  Invalid Request The JSON sent is not a valid Request object.
// -32601  Method not found  The method does not exist / is not available.
// -32602  Invalid params  Invalid method parameter(s).
// -32603  Internal error  Internal JSON-RPC error.
// -32000 to -32099  Server error  Reserved for implementation-defined server-errors.
