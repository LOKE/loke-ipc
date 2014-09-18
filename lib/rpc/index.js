var Q = require('q');
var service = require('./rpcservice');
var client = require('./rpcclient');

var RpcService = exports.RpcService = service.RpcService;
var RpcClient = exports.RpcClient = client.RpcClient;

exports.createRpcService = function (serviceName, version, meta) {
  return new RpcService(serviceName, version, meta);
};

exports.createRpcClient = function () {
  return new RpcClient();
};

//
// Helper functions
//
exports.createMetaInterfaceMethods = function (serviceRpc, metaRpc) {
  metaRpc.exposeMethod('getServiceInterface', function (params, done) {
    Q.try(function () {
      return serviceRpc.getMeta();
    }).nodeify(done);
  });

  metaRpc.exposeMethod('getMetaInterface', function (params, done) {
    Q.try(function () {
      return metaRpc.getMeta();
    }).nodeify(done);
  });
};

exports.createFromService = function (service, version) {
  var serviceConstructor = service.constructor;
  var serviceName = serviceConstructor.$service || serviceConstructor.name;

  var serviceRpc = new RpcService(serviceName, version);

  // TODO: allow for custom timeouts.
  var timeout = 1000;

  console.log(serviceConstructor.$expose);

  serviceConstructor.$expose.forEach(function (methodName) {
    serviceRpc.exposeServiceMethod(service, methodName, timeout);
  });

  return serviceRpc;
};
