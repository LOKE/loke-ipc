var rpcservice = require('../lib/rpc/rpcservice');
var sinon = require('sinon');
var q = require('q');
require('should');

var service;
var mock;



var resultResponse = sinon.match(function (response) {
  return response.error === null &&
         /string|number/.test(typeof response.id);
}, 'resultResponse');

var errorResponse = sinon.match(function (response) {
  return response.error !== null &&
         response.result === null &&
         typeof response.error.code === 'number' &&
         /string|number/.test(typeof response.id);
}, 'resultResponse');

var parseErrorResponse = sinon.match(function (response) {
  return response.error !== null &&
         response.result === null &&
         response.error.code === -32700;
}, 'parseErrorResponse');




beforeEach(function () {
  service = new rpcservice.RpcService('someService', 1);
  mock = sinon.mock(service);
});

afterEach(function () {
  mock.verify();
  mock.restore();
});

describe('RpcService', function () {


  describe('#exposeMethod()', function () {

    it('should add a method to the rpcservice', function () {
      service.exposeMethod('someMethod', function () {});
      service.methods.should.have.property('someMethod');
    });

    it('should add methods with custom timeouts', function () {
      service.exposeMethod('someTimeoutMethod', function () {}, 999);
      service.methods.should.have.property('someTimeoutMethod')
      .with.property('timeout', 999);
    });
  });


  describe('#exposeServiceMethod()', function () {
    var someService;

    beforeEach(function () {
      someService = {
        serviceMethod: function () {}
      };

      someService.serviceMethod.$timeout = 999;
    });

    it('should expose a method on a service', function () {
      service.exposeServiceMethod(someService, 'serviceMethod');

      service.methods.should.have.property('serviceMethod');
    });

    it('should expose a method on a service with custom timeouts', function () {
      service.exposeServiceMethod(someService, 'serviceMethod');
      service.methods.should.have.property('serviceMethod')
      .with.property('timeout', 999);
    });
  });


  describe('#_handleMsg()', function () {
    var method;

    beforeEach(function () {
      method = sinon.stub();
      method.callsArg(1);

      service.exposeMethod('aMethod', method);
    });

    afterEach(function () {
      method.reset();
    });

    it('should call method', function (done) {
      var msg = {
        content: new Buffer(JSON.stringify({
          id: 1,
          method: 'aMethod',
          params: []
        }))
      };

      mock.expects('_handleResponse')
      .once()
      .withArgs(msg, resultResponse)
      .returns(q.when());

      service._handleMsg(msg)
      .nodeify(done);

    });

    it('should error on invalid json buffer', function (done) {
      var msg = {
        content: new Buffer('{ invalid json }')
      };

      mock.expects('_handleResponse')
      .once()
      .withArgs(msg, parseErrorResponse)
      .returns(q.when());

      service._handleMsg(msg)
      .nodeify(done);

    });

    it('should send a error response if error', function (done) {
      method.callsArgWith(1, new Error());

      var msg = {
        content: new Buffer(JSON.stringify({
          id: 3,
          method: 'aMethod',
          params: []
        }))
      };

      mock.expects('_handleResponse')
      .once()
      .withArgs(msg, errorResponse)
      .returns(q.when());

      service._handleMsg(msg)
      .nodeify(done);

    });

    it('should call fire request:start event', function (done) {
      var msg = {
        content: new Buffer(JSON.stringify({
          id: 1,
          method: 'aMethod',
          params: []
        }))
      };

      mock.expects('_handleResponse')
        .once()
        .withArgs(msg, resultResponse)
        .returns(q.when());

      service.on('request:start', function(e) {
        e.should.have.property('request');
        e.should.have.property('method');
        e.method.should.equal('aMethod');
        done();
      });

      service._handleMsg(msg).done();
    });

    it('should call fire request:complete event with duration', function (done) {
      var msg = {
        content: new Buffer(JSON.stringify({
          id: 1,
          method: 'aMethod',
          params: []
        }))
      };

      mock.expects('_handleResponse')
        .once()
        .withArgs(msg, resultResponse)
        .returns(q.when());

      service.on('request:complete', function(e) {
        e.should.have.property('request');
        e.should.have.property('response');
        e.should.have.property('method');
        e.should.have.property('duration');

        e.method.should.equal('aMethod');
        e.duration.should.be.above(0);
        e.duration.should.be.below(100); // no way this should be above 100ms 

        done();
      });

      service._handleMsg(msg).done();
    });



    it('should call fire request:error event on error', function (done) {

      var msg = {
        content: new Buffer(JSON.stringify({
          id: 1,
          method: 'aMethod',
          params: []
        }))
      };

      mock.expects('_handleRequest')
        .returns(q.reject(new Error('Rejected')));

      service.on('request:error', function(e) {
        try {
          e.should.have.property('error');
          e.should.have.property('method');
          e.method.should.equal('aMethod');
          e.error.message.should.equal('Rejected');
        } catch(err) {
          return done(err);
        }
        done();
      });

      service._handleMsg(msg)
        .fail(function(err) { })
        .done();
    });

  });


  describe('#getMeta', function () {
    beforeEach(function () {
      var someService = {
        serviceMethod: function () {},
        serviceMethodWithParams: function (paramA, paramB) {}
      };

      service.exposeMethod('aMethodWithNoParams', function () {});
      service.exposeServiceMethod(someService, 'serviceMethod');
      service.exposeServiceMethod(someService, 'serviceMethodWithParams');
    });

    it('should return method info', function () {
      var meta = service.getMeta();

      meta.version.should.be.exactly(1);
      meta.serviceName.should.be.exactly('someService');
      meta.dateExposed.should.be.instanceOf(Date);

      meta.interfaces.should
      .containDeep([{ methodName: 'aMethodWithNoParams' }])
      .containDeep([{ methodName: 'serviceMethod' }])
      .containDeep([{ methodName: 'serviceMethodWithParams' }]);

      meta.interfaces.filter(function (i) {
        return i.methodName === 'serviceMethodWithParams'; }
      )[0]
      .should.have.property('paramNames').with.containDeepOrdered(['paramA', 'paramB']);

    });
  });
});
