/* eslint-disable no-console */
module.exports = {
  debug: function () {},
  info: console.info.bind(console, 'Info:'),
  warn: console.warn.bind(console, 'WARNING:'),
  error: console.error.bind(console, '###ERROR###:')
};
