var path = require('path');
var IPC_MANIFESTS_FOLDER = 'ipc_manifests';

exports.load = function (serviceName) {
  // This rootModule thing kind sucks. might want to think of a better way
  var paths = getPaths(path.dirname(rootModule().filename));
  var meta;

  for (var i = 0; i < paths.length; i++) {
    try {
      meta = require(paths[i] + '/' + serviceName + '.json');
      return meta;
    } catch (e) {}
  }

  throw new Error('Couldn\' load ' + serviceName);
};

function rootModule() {
  var mod = module;

  while (mod.parent) {
    mod = mod.parent;
  }

  return mod;
}

function getPaths(from) {
  // guarantee that 'from' is absolute.
  from = path.resolve(from);

  var splitRe = process.platform === 'win32' ? /[\/\\]/ : /\//;
  var paths = [];
  var parts = from.split(splitRe);

  for (var tip = parts.length - 1; tip >= 0; tip--) {
    if (parts[tip] === IPC_MANIFESTS_FOLDER) { continue; }
    var dir = parts.slice(0, tip + 1).concat(IPC_MANIFESTS_FOLDER).join(path.sep);
    paths.push(dir);
  }

  return paths;
}
