// Returns a constructor for a class that we interact with to
// make external service rpc calls
var atil = require('atil');

function createMethod(rpcClient, serviceName, version, methodInfo) {
  var method = methodInfo.methodName;
  var timeout = methodInfo.methodTimeout;

  return function () {
    var params = Array.prototype.slice.call(arguments);
    return rpcClient.request(serviceName, version, method, params, timeout);
  };
}

exports = module.exports = function(serviceName, version) {

  var Ctor = function(comms, logger) {
    this._comms = comms;
    this._logger = logger;

    this._logger.debug('Note: ' + serviceName + ' methods not avalibale yet.');
  };

  Ctor.$service = serviceName;
  Ctor.$versionNumber = version;
  Ctor.$inject = ['Comm', 'Logger'];
  Ctor.$isExternalService = true;
  Ctor.$iocLifecycleType = 'singleton';

  Ctor.prototype.start = function () {
    var self = this;
    return self._comms.getRpcClient()
    .then(function (rpcClient) {
      self._rpcClient = rpcClient;
      return rpcClient.getMeta(serviceName, version);
    })
    .then(function (serviceMeta) {
      var methods = serviceMeta.interfaces;

      methods.forEach(function (methodInfo) {
        var method = createMethod(self._rpcClient, serviceName, version, methodInfo);
        Ctor.prototype[methodInfo.methodName] = method;
      });

      self._logger.debug(serviceName + ' Methods now avalibale: ' +
        methods.map(function(m) { return m.methodName; }).join(', '));
    });
  };

  Ctor.prototype.stop = function () {
    return Q.resolve();
  };

  return Ctor;
};
