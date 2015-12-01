var Q = require('q');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var fnAnnotate = require('fn-annotate');
// Wraps the request callbacks, sockets and emitters into a nice interface.
// Create it, then call repond in the callback for a reply
// For a request, create it and then just call request
// Holds REQ sockets. REP sockets managed by main Communications class
function RpcMethod (paramNames, listener, timeout, methodName) {
  this.timeout = timeout || 1000;
  this.paramNames = paramNames;
  this.methodName = methodName;
  if (listener) {
    this.on('request', listener);
  }
}

util.inherits(RpcMethod, EventEmitter);

RpcMethod.prototype.execRequest = function(request) {
  var self = this;

  return Q.Promise(function (resolve, reject, notify) {
    self.emit('request', request.params, function (err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(formatResponse(request.id, result));
      }
    });
  })
  .timeout(self.timeout, 'RpcMethod Timeout: ' + (self.methodName || 'anonymous'));
};

exports.createFromServiceMethod = function (service, methodName, timeout) {
  var paramNames = fnAnnotate(service[methodName]);

  return new RpcMethod(paramNames, function (params, done) {
    Q.try(function () {
      return service[methodName].apply(service, params);
    })
    .nodeify(done);
  }, timeout, methodName);
};

function formatResponse (id, result) {
  return {
    result: result,
    error: null,
    id: id
  };
}

function formatError (id, error) {
  // @TODO: do some filtering here for better errors, look at json-rpc error codes
  return {
    result: null,
    error: {
      code: error.code || -32000,
      message: error.message,
      data: error
    },
    id: id
  };
}

exports.formatError = formatError;

exports.RpcMethod = RpcMethod;
