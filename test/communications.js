'use strict';

var rpc = require('../lib/rpc');
var Communications = require('../lib/communications');

var sinon = require('sinon');
require('should');

function nullLog() { }

var logger = {
  debug: nullLog.bind(),
  info: nullLog.bind(),
  warn: nullLog.bind(),
  error: nullLog.bind()
};


var someService = { serviceMethod: function () {} };
someService.serviceMethod.$timeout = 999;
someService.name = 'someService';
someService.$expose = ['serviceMethod'];
someService.$version = 0;

describe('Communications', function () {

  describe('#exposeService()', function () {
    var mock = sinon.mock(rpc);
    var rpcService = new rpc.RpcService(someService.name, someService.$version, false, logger);

    mock.expects('createFromService')
      .returns(rpcService);

    it('should proxy RPC request events', function (done) {
      var comms = new Communications('', logger);
      comms.exposeService(someService, someService);

      // these are the events we are expecting to be proxied
      var expectedEvents = 4;
      comms.on('request:start', decrementCount);
      comms.on('request:complete', decrementCount);
      comms.on('request:error', decrementCount);
      comms.on('request:uncaughterr', decrementCount);

      rpcService.emit('request:start', {i: 4});
      rpcService.emit('request:complete', {i: 3});
      rpcService.emit('request:error', {i: 2});
      rpcService.emit('request:uncaughterr', {i: 1});

      function decrementCount(e) {
        // check that the args were passed through...
        // since events will arrive in sequence we can check e.i
        e.i.should.equal(expectedEvents);
        if (--expectedEvents === 0) {
          done();
        }
      }
    });

  });

});
