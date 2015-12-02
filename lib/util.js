'use strict';

var os = require('os');
var guid = require('node-uuid').v4;

exports.getUniqueQueueName = function (queueName) {
  return os.hostname() + ':' + process.pid + '-' + queueName + '-' + guid();
};
