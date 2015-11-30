var rpc = require('../lib/rpc');
var Communications = require('../lib/communications');

var sinon = require('sinon');
var q = require('q');
require('should');

var service;

function nullLog() { }

var logger = {
  debug: nullLog.bind(),
  info: nullLog.bind(),
  warn: nullLog.bind(),
  error: nullLog.bind()
};


var someService = { serviceMethod: function () {} };
someService.serviceMethod.$timeout = 999;
someService.name = 'someService'
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

      rpcService.emit('request:start', {});
      rpcService.emit('request:complete', {});
      rpcService.emit('request:error', {});
      rpcService.emit('request:uncaughterr', {});

      function decrementCount() {
        if (--expectedEvents === 0) {
          done();
        }
      }
    });

  });

});
