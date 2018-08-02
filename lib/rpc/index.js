var Q = require('q');
var service = require('./rpcservice');
var client = require('./rpcclient');

var RpcService = exports.RpcService = service.RpcService;
var RpcClient = exports.RpcClient = client.RpcClient;

exports.createRpcService = function (serviceName, version, meta, options) {
  return new RpcService(serviceName, version, meta, options);
};

exports.createRpcClient = function () {
  return new RpcClient();
};

//
// Helper functions
//
exports.createMetaInterfaceMethods = function (serviceRpc, metaRpc) {
  metaRpc.exposeMethod('getServiceInterface', function (/* params */) {
    return Q.try(function () {
      return serviceRpc.getMeta();
    });
  });

  metaRpc.exposeMethod('getMetaInterface', function (/* params, done */) {
    return Q.try(function () {
      return metaRpc.getMeta();
    });
  });
};

exports.createFromService = function (definition, service, options) {
  var version = definition.$version || 0;
  var serviceName = definition.$service || definition.name;

  var serviceRpc = new RpcService(serviceName, version, false, options);

  definition.$expose.forEach(function (methodName) {
    serviceRpc.exposeServiceMethod(service, methodName, options);
  });

  return serviceRpc;
};
