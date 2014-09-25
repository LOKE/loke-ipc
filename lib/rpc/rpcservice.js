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
function RpcService (serviceName, version, meta) {
  if (!serviceName) {
    throw new Error('Cannot create service, no serviceName');
  }

  this.name = serviceName;
  this.version = version || 0;
  this.methods = {};
  this.isMeta = meta === true;
  var queueTail = this.isMeta ? 'meta' : 'request';

  this.queueName = util.format('%s-%d-%s', this.name, this.version, queueTail);
}

util.inherits(RpcService, EventEmitter);

exports.RpcService = RpcService;

function formatLogMsg(rpc) {
  var req = rpc.request;
  var res = rpc.response;

  if (res.error) {
    if (req) {
      return  util.format('Rpc error: %s%s >!> Error: %s', req.method, JSON.stringify(req.params), res.error.message);
    } else {
      return  util.format('Rpc request error: ??? >!> Error: %s', res.error.message);
    }
  } else {
    return  util.format('Rpc: %s%s >>> %s', req.method, JSON.stringify(req.params), JSON.stringify(res.result));
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
    self.ch.consume(self.queueName, function(msg) {
      var d = domain.create();
      d.cid = msg.properties.correlationId || guid();

      d.run(function () {
        self._handleMsg(msg)
        .then(function (rpc) {
          var res = rpc.response;
          var log = formatLogMsg(rpc);

          if (res.error) {
            comm.reportError(log, rpc);
          } else {
            comm.debugLog(log, rpc);
          }

          return self._handleResponse(msg, res);
        }).done();
      });

      d.on('error', function (err) {
        comm.reportError('BAD REQUEST ERROR: ' + err.message, err);
        self._handleResponse(msg, self.jsonRPCError(null, err));
        d.dispose();
      });
    });
  });

};

RpcService.prototype._handleMsg = function (msg) {
  var self = this;

  return Q.try(function () {
    return JSON.parse(msg.content.toString());
  })
  .then(function (request) {
    return self._handleRequest(request)
    .then(function (result) {
      return self.jsonRPCResponse(request.id, result);
    })
    .fail(function (err) {
      return self.jsonRPCError(request.id, err);
    })
    .then(function(response) {
      return {
        request: request,
        response: response
      }
    });
  })
  .fail(function (err) {
    return {
      request: null,
      response: self.jsonRPCError(null, err)
    };
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
  return this.methods[request.method].execRequest(request);
};

RpcService.prototype._handleResponse = function (msg, response) {
  var replyTo = msg.properties.replyTo;

  var options = {
    deliveryMode: true,
    correlationId: process.domain.cid || guid()
  };

  var chunk = new Buffer(JSON.stringify(response));
  var res = this.ch.sendToQueue(replyTo, chunk, options);
  this.ch.ack(msg);
  return res;
};

RpcService.prototype.jsonRPCResponse = function (id, result) {
  return {
    result: result,
    error: null,
    id: id
  };
};

RpcService.prototype.jsonRPCError = function (id, error) {
  // @TODO: do some filtering here for better errors, look at json-rpc error codes
  return {
    result: null,
    error:{
      code: error.code || -32000,
      message: error.message,
      data: error
    },
    id: id
  };
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
