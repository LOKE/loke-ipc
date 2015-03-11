var CHANNEL_LIMIT = 8;

var amqplib = require('amqplib');
var Q = require('q');

exports.Communications = Communications;
var externalServiceBuilder = require('./externalservicebuilder');
var rpc = require('./rpc');
var pubsub = require('./pubsub');

function Communications (url, logger) {
  this.url = url;
  this.channels = [];
  this._serviceToClose = [];

  // a logger can be optionally specified, else console.* will be used
  this._logger = logger || require('./console-logger');

  this.serviceRepliers = {};
  this.serviceMetaRepliers = {};
}

///////////////////////
// Lifecycle Methods //
///////////////////////

Communications.prototype.start = function () {
  var self = this;
  self._logger.debug('Starting Communications');
  return Q.try(function () {
    return self._connect();
  })
  .then(function () {
    self._logger.debug('Started Communications');
  });

  // @TODO: if we've got the logging service, add a context builder method here.
};

Communications.prototype.stop = function () {
  var self = this;

  self._logger.debug('stopped Communications');

  return self.closeServices()
  .then(function() {
    return self._connectionPromise
    .then(function (connection) {
      return connection.close();
    });
  });
};

///////////////////
// SETUP METHODS //
///////////////////


Communications.prototype._connect = function () {
  var self = this;

  var url = self.url || 'amqp://localhost';
  self._logger.debug('Connecting to rabbitmq at ' + url);

  self._connectionPromise = Q.when(amqplib.connect(url));

  return self._connectionPromise
  .then(function (connection) {
    self.connection = connection;
    // @NOTE: if we lose connection to rabbit, KILL PROCESS.....
    // we do this b/c we lose alot of certainty about the state of this system after losing
    // the connection and the safest thing to do is stop and start again via upstart or w/e
    // 
    // ------------
    // TODO: rather than process.exit from a module (which is just wierd) throw an 'error' event from this instance.
    // If nothing handles the error the process will exit anyway.
    // But it gives the application using the module to handle the exit in a more graceful way
    // - DW
    // ------------
    // 
    connection.on('error', function (err) {
      if (self.onerror) {
        return self.onerror(err);
      }
      throw new Error('KILLING PROCESS, Received an error in rabbitmq connection: \n'+err.stack);
    });
    connection.on('close', function (err) {
      if (self.onclose) {
        return self.onclose(err);
      }
      throw new Error('KILLING PROCESS, Rabbitmq connection closed: \n'+err.stack);
    });
  });
};

// @TODO: add command to get status (sockets connected, public interface, exposed name, general rabbit info)


// Exposes a public interface that can be used to make rpc requests into this service
// Interface is retrieved via the servicename-metadata queue.
// Creates a service replies queue for rpc to this service
// Also creates a broadcast queue to make rpc requests that should hit all services intances.
// classes is the wired class constructors, NOT instances.
// instanceContainer is typically the IOC class. It should return a class instance with .get().
Communications.prototype.exposeServices = function (version, services, instanceContainer) {
  var self = this;

  if (!Array.isArray(services)) {
    throw new Error('services must be an array of strings');
  } else {
    return Q.all(services.map(function (serviceName) {
      var serviceInstance = instanceContainer.get(serviceName);
      return self.exposeService(version, serviceInstance);
    }));
  }
};


Communications.prototype.exposeService = function (version, serviceInstance) {
  var self = this;

  if (!serviceInstance.constructor.$expose) {
    throw new Error('Service requires $expose on the constructor');
  }

  var serviceRpc = rpc.createFromService(serviceInstance, version, self._logger);
  var metaRpc = rpc.createRpcService(serviceRpc.name, version, true, self._logger);

  rpc.createMetaInterfaceMethods(serviceRpc, metaRpc);

  self.serviceRepliers[serviceRpc.name] = serviceRpc;
  self.serviceMetaRepliers[metaRpc.name] = metaRpc;

  self._serviceToClose.push(serviceRpc, metaRpc);

  self._logger.debug('Exposing service ' + serviceRpc.name);

  return Q.try(function () {
    return serviceRpc.setupSocket(self);
  })
  .then(function () {
    return metaRpc.setupSocket(self);
  });

};

Communications.prototype.closeServices = function() {
  return Q.all(this._serviceToClose.map(function (service) {
    return service.close();
  }));
};


Communications.prototype.getChannel = function () {
  var chanPromise;

  if (this.channels.length < CHANNEL_LIMIT) {

    chanPromise = this._connectionPromise.post('createChannel');
  } else {
    chanPromise = this.channels.shift();
  }

  this.channels.push(chanPromise);
  return chanPromise;
};


Communications.prototype.getRpcClient = function () {
  if (!this._rpcClientPromise) {
    this._rpcClient = rpc.createRpcClient();
    this._rpcClientPromise = this._rpcClient.setupSocket(this)
    .thenResolve(this._rpcClient);
  }
  return this._rpcClientPromise;
};


Communications.prototype.getSubscriber = function () {
  if (!this._rpcSubscriberPromise) {
    this._rpcSubscriber = new pubsub.Subscriber();
    this._rpcSubscriberPromise = this._rpcSubscriber.setupSocket(this)
    .thenResolve(this._rpcSubscriber);
  }
  return this._rpcSubscriberPromise;
};


Communications.prototype.createPublisher = function (serviceName) {
  var publisher = new pubsub.Publisher(serviceName);

  return publisher.setupSocket(this)
  .thenResolve(publisher);
};

Communications.prototype.reportError = function (msg, error) {
  this._logger.error(msg, error);
};

Communications.prototype.debugLog = function (msg, data) {
  this._logger.debug(msg, data);
};

Communications.prototype.create = function(externalServiceName, versionNumber) {
  var Ctor = Communications.create(externalServiceName, versionNumber);
  var service = new Ctor(this, this._logger);

  return service.start()
  .then(function() {
    return service;
  });
};

// Used for the creation of convenience rpc methods for external service interfaces
Communications.create = function(externalServiceName, versionNumber) {
  return externalServiceBuilder(externalServiceName, versionNumber);
};

module.exports = exports = Communications;
