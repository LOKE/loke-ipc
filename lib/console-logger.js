module.exports = exports = {
  debug: console.log.bind(console, 'debug:'),
  info: console.info.bind(console, 'Info:'),
  warn: console.warn.bind(console, 'WARNING:'),
  error: console.error.bind(console, '###ERROR###:')
};
