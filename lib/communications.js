var CHANNEL_LIMIT = 8;
var LOCALHOST_AMQP = 'amqp://localhost';

var amqplib = require('amqplib');
var Q = require('q');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

exports.Communications = Communications;
var externalServiceBuilder = require('./externalservicebuilder');
var rpc = require('./rpc');
var pubsub = require('./pubsub');

/**
 * LOKE IPC Communications
 * @param  {Object}  [options] - options
 * @param  {ILogger} [options.logger] - the logger to use
 * @param  {string}  [options.amqpUri] - the AMQP URI to connect to. defaults to localhost.
 * @param  {Object}  [options.newRelic] - new relic instance that will be used for tracing if provided
 */
function Communications(options) {
  EventEmitter.call(this);

  this.options = options;
  this.amqpUri = options && options.amqpUri;
  this.channels = [];
  this.rpcClient = rpc.createRpcClient();
  this._serviceToClose = [];

  // a logger can be optionally specified, else console.* will be used
  this._logger = (options && options.logger) || require('./console-logger');

  this.serviceRepliers = {};
  this.serviceMetaRepliers = {};
}

util.inherits(Communications, EventEmitter);

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
    return self.getRpcClient();
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

  var amqpUri = self.amqpUri || LOCALHOST_AMQP;
  self._logger.debug('Connecting to rabbitmq at ' + amqpUri);

  self._connectionPromise = Q.when(amqplib.connect(amqpUri));

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



/**
 * Exposes a public interface that can be used to make rpc requests into this service
 * Interface is retrieved via the servicename-metadata queue.
 * Creates a service replies queue for rpc to this service
 * Also creates a broadcast queue to make rpc requests that should hit all services intances.
 * classes is the wired class constructors, NOT instances.
 * instanceContainer is typically the IOC class. It should return a class instance with .get().
 * @param  {number} version               - tbd
 * @param  {string[]} services            - tbd
 * @param  {ServiceContainer} instanceContainer - tbd
 * @param  {Object} [options]             - tbd
 * @return {Promise}                      - promise that resolves when done
 */
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

/**
 * Exposes (publishes) a service
 * @param  {Object} serviceInstance     - the service being published
 * @param  {Object} definition          - the service publish definition
 * @param  {Object} [options]             - the service options
 * @param  {NewRelic} [options.newRelic] - optionally provide an instance of the new relic module. If provided it will be used for request.
 * @return {Promise<?>}                 [description]
 */
Communications.prototype.exposeService = function (serviceInstance, definition) {
  var self = this;

  var options = this.options;

  // if no definition supplied, look for definition as metadata properties on the serviceInstance constructor
  // (for legacy shit)
  if (!definition) {
    definition = serviceInstance.constructor;
  }

  if (!definition.$expose) {
    throw new Error('Service requires $expose on the constructor');
  }

  var version = definition.$version || 0;

  var serviceRpc = rpc.createFromService(definition, serviceInstance, options);
  this._bindRequestEvents(serviceRpc);

  var metaRpc = rpc.createRpcService(serviceRpc.name, version, true, options);

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
  })
  .then(function () {
    return {
      service: serviceRpc,
      meta: metaRpc
    };
  });
};

Communications.prototype._bindRequestEvents = function (serviceRpc) {
  var proxyRequestStart =     this._proxyEvent.bind(this, 'request:start');
  var proxyRequestComplete =  this._proxyEvent.bind(this, 'request:complete');
  var proxyRequestError =     this._proxyEvent.bind(this, 'request:error');
  var proxyRequestUncaughtError = this._proxyEvent.bind(this, 'request:uncaughterr');

  serviceRpc.on('request:start', proxyRequestStart);
  serviceRpc.on('request:complete', proxyRequestComplete);
  serviceRpc.on('request:error', proxyRequestError);
  serviceRpc.on('request:uncaughterr', proxyRequestUncaughtError);

  serviceRpc.on('close', function() {
    serviceRpc.removeListener('request:start', proxyRequestStart);
    serviceRpc.removeListener('request:complete', proxyRequestComplete);
    serviceRpc.removeListener('request:error', proxyRequestError);
    serviceRpc.removeListener('request:uncaughterr', proxyRequestUncaughtError);
  });
};

Communications.prototype._proxyEvent = function (eventName, eventArgs) {
  this.emit(eventName, eventArgs);
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
    this._rpcClientPromise = this.rpcClient.setupSocket(this)
    .thenResolve(this.rpcClient);
  }
  return this._rpcClientPromise;
};


Communications.prototype.getSubscriber = function () {
  if (!this._rpcSubscriberPromise) {
    this._rpcSubscriber = new pubsub.Subscriber(this._logger);
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

/**
 * Container that provides services.
 * @interface ServiceContainer
 */
/**
 * Gets a container by it's name or key
 * @function
 * @name ServiceContainer#get
 * @param {string} name - the name or key of the service
 * @returns {*} an instance of the named service
 */


/**
 * Container that provides services.
 * @interface ILogger
 */
/**
 * Gets a container by it's name or key
 * @function
 * @name ILogger#info
 * @param {string} arg - the argument to log
 */
/**
 * Gets a container by it's name or key
 * @function
 * @name ILogger#warn
 * @param {string} arg - the argument to log
 */
/**
 * Gets a container by it's name or key
 * @function
 * @name ILogger#error
 * @param {string} arg - the argument to log
 */
/**
 * Gets a container by it's name or key
 * @function
 * @name ILogger#debug
 * @param {string} arg - the argument to log
 */
