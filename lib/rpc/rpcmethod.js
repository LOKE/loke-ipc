var Q = require('q');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var fnAnnotate = require('fn-annotate');
// Wraps the request callbacks, sockets and emitters into a nice interface.
// Create it, then call repond in the callback for a reply
// For a request, create it and then just call request
// Holds REQ sockets. REP sockets managed by main Communications class

function RpcMethod (paramNames, listener, timeout, methodName, serviceName, options) {

  var self = this;

  this.timeout = timeout || 1000;
  this.paramNames = paramNames;
  this.methodName = methodName;
  this.listener = listener;

  if (options && options.newRelic) {
    var newRelic = options.newRelic;
    var execRequest = this.execRequest;
    this.execRequest = newRelic.createWebTransaction('rpc/'+serviceName+'/'+methodName, function (request) {
      return execRequest.call(self, request)
      .catch(function(err) {
        newRelic.noticeError(err);
        throw err;
      })
      .finally(function() {
        newRelic.endTransaction();
      });
    });
  }
}

util.inherits(RpcMethod, EventEmitter);

RpcMethod.prototype.execRequest = function(request) {
  var self = this;

  return self.listener(request.params)
  .then(function(result) {
    return formatResponse(request.id, result);
  })
  .timeout(self.timeout, 'RpcMethod Timeout: ' + (self.methodName || 'anonymous'));
};

exports.createFromServiceMethod = function (service, methodName, serviceName, timeout, options) {
  var paramNames = fnAnnotate(service[methodName]);

  var listener = function rpcMethodListener(params) {
    return Q.try(options.newRelic.createTracer('exec method', function () {
      return service[methodName].apply(service, params);
    }));
  };

  return new RpcMethod(paramNames, listener, timeout, methodName, serviceName, options);
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
