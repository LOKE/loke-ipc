var Q = require('q');
var service = require('./rpcservice');
var client = require('./rpcclient');

var RpcService = exports.RpcService = service.RpcService;
var RpcClient = exports.RpcClient = client.RpcClient;

exports.createRpcService = function (comm, serviceName, version, meta) {
  return new RpcService(comm, serviceName, version, meta);
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

exports.createFromService = function (comm, service, version) {
  var serviceConstructor = service.constructor;
  var serviceName = serviceConstructor.$service || serviceConstructor.name;

  var serviceRpc = new RpcService(comm, serviceName, version);

  // TODO: allow for custom timeouts.
  var timeout = 1000;

  console.log(serviceConstructor.$expose);

  serviceConstructor.$expose.forEach(function (methodName) {
    serviceRpc.exposeServiceMethod(service, methodName, timeout);
  });

  return serviceRpc;
};
