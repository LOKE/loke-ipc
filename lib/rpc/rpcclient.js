var Q = require('q');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var guid = require('node-uuid').v4;
var commUtil = require('../util');
var manifestLoader = require('./manifest-loader');

var DEFAULT_TIMEOUT = 20000;

// Wraps the request callbacks, sockets and emitters into a nice interface.
// Create it, then call repond in the callback for a reply
// For a request, create it and then just call request
// Holds REQ sockets. REP sockets managed by main Communications class
function RpcClient () {
  this.requests = {};
}

util.inherits(RpcClient, EventEmitter);

exports.RpcClient = RpcClient;

// Sets up the temporary socket that emits the reponse and connected events
RpcClient.prototype.setupSocket = function (comm) {
  var self = this;

  return comm.getChannel()
  .then(function (ch) {
    self.ch = ch;
    return ch.assertQueue(commUtil.getUniqueQueueName('rpcreplies'), {exclusive: true, autoDelete: true});
  })
  .then(function (ok) {
    self.replyQueue = ok.queue;
    self.ch.consume(ok.queue, function(msg) {
      self.handleMsg(msg)
      .fail(function(err) {
        comm.reportError('BAD RESPONSE ERROR: ' + err.message, err);
      }).done();
      self.ch.ack(msg);
    }, {noAck: false, exclusive: true});
  });
};

// Returns promise that resolves to request's reponse (which is emitted by socket data handler)
RpcClient.prototype.request = function (serviceName, version, method, params, timeout) {

  var queueName = util.format('%s-%d-request', serviceName, version);
  var id = guid();

  var request = {
    id: id,
    method: method,
    params: params
  };

  return this.handleRequest(queueName, request, timeout);

};

RpcClient.prototype.handleRequest = function (queueName, request, timeout) {
  var self = this;

  timeout = timeout || DEFAULT_TIMEOUT;
  var domain = process.domain;
  var deffered = Q.defer();
  var id = request.id;
  var cid;

  if (domain && domain.cid) {
    cid = domain.cid;
  } else {
    cid = guid();
  }

  var requestRecord = {
    request: request,
    domain: domain,
    cid: cid,
    deffered: deffered
  };

  var options = {
    replyTo: self.replyQueue,
    expiration: timeout.toString(),
    deliveryMode: true,
    correlationId: cid
  };

  var chunk = new Buffer(JSON.stringify(request));

  self.ch.sendToQueue(queueName, chunk, options);
  self.requests[id] = requestRecord;

  return deffered.promise
  .timeout(timeout, 'RPC request "' + request.method + '" timed out after ' + timeout + 'ms.')
  .fail(function (err) {
    if (id in self.requests) {
      delete self.requests[id];
    }
    throw err;
  });
};

RpcClient.prototype.handleMsg = function (msg) {
  var self = this;

  return Q.try(function () {
    return JSON.parse(msg.content.toString());
  })
  .then(function (response) {
    return self.handleResponse(response);
  });
};


RpcClient.prototype.handleResponse = function (response) {
  var id = response.id;
  var requestRecord = this.requests[id];

  if (!requestRecord) {
    throw new Error('Cant find requestRecord', id);
  }

  var deffered = requestRecord.deffered;

  function handle() {
    if (response.error) {
      var err = new Error(response.error.message);

      deffered.reject(err);
    } else {
      deffered.resolve(response.result);
    }
  }

  if (requestRecord.domain) {
    requestRecord.domain.run(handle);
  } else {
    handle();
  }

  delete this.requests[id];
};

RpcClient.prototype.getMeta = function (serviceName, version) {
  var queueName = util.format('%s-%d-meta', serviceName, version);

  var request = {
    id: guid(),
    method: 'getServiceInterface',
    params: []
  };

  return this.handleRequest(queueName, request, 1000);
};

RpcClient.prototype.createInterface = function (meta) {
  var rpcInterface = {};
  var self = this;

  meta.interfaces.forEach(function (iface) {
    rpcInterface[iface.methodName] = function () {
      var params = Array.prototype.slice.call(arguments);
      return self.request(meta.serviceName, meta.version, iface.methodName, params, iface.methodTimeout);
    };
  });

  return rpcInterface;
};

RpcClient.prototype.load = function (serviceName) {
  return this.createInterface(manifestLoader.load(serviceName));
};

RpcClient.prototype.closeSocket = function () {
  // TODO: Why have this method if it does nothing!?
};
