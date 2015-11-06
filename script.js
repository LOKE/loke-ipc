#!/usr/bin/env node
var ipc = require('./lib');
var logger = {
  debug: function () {},
  info: console.info.bind(console, 'Info:'),
  warn: console.warn.bind(console, 'WARNING:'),
  error: console.error.bind(console, '###ERROR###:')
};
var comms;

ipc.connect('amqp://prod-srv02.prod.aston.srv', logger)
.then(function (_comms) {
  comms = _comms;

  function loadService(service) {
    return comms.create(service.name, service.version)
    .then(function (_client) {
      service.client = _client;
      return service;
    })
    .fail(function (err) {
      console.log('Error conecting rpc service:', err);
    });
  }

  return loadService({ name: 'access-tokens', version: 1 });
})
.then(function (service) {
  return service.client.generateAccessToken({
    clientId: 'manually-created-token',
    resourceOwnerType: 'merchant',
    scope: ['posapi'],
    expires: '2050-01-01T00:00:00.000Z',
    resourceOwnerId: process.argv[2]
  });
})
.done(function (res) {
  comms.stop();
  console.log(res.accessToken);
});
