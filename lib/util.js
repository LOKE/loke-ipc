var os = require('os');
var guid = require('uuid/v4');

exports.getUniqueQueueName = function (queueName) {
  return os.hostname() + ':' + process.pid + '-' + queueName + '-' + guid();
};
