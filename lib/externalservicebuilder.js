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
  var Constructor = function() {
    this.services = atil.mapInjectedServices(this, arguments);
    this.services.Logger.debug('Note: ' + serviceName + ' methods not avalibale yet.');
  };

  Constructor.$service = serviceName;
  Constructor.$versionNumber = version;
  Constructor.$inject = ['Comm', 'Logger'];
  Constructor.$isExternalService = true;
  Constructor.$iocLifecycleType = 'singleton';

  Constructor.prototype.$start = function () {
    var self = this;
    return self.services.Comm.getRpcClient()
    .then(function (rpcClient) {
      self._rpcClient = rpcClient;
      return rpcClient.getMeta(serviceName, version);
    })
    .then(function (serviceMeta) {
      var methods = serviceMeta.interfaces;

      methods.forEach(function (methodInfo) {
        var method = createMethod(self._rpcClient, serviceName, version, methodInfo);
        Constructor.prototype[methodInfo.methodName] = method;
      });

      self.services.Logger.debug(serviceName + ' Methods now avalibale.');
    });
  };

  Constructor.prototype.$stop = function () {

  };

  return Constructor;
};
