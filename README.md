# LOKE IPC (Inter-process comms) Library



## Connecting

```js
var lokeIpc = require('loke-ipc');

lokeIpc.connect()
.then(function(connection) {
   console.log('Connected!');
});
```

Alternatively use the constructor:
```js
var Communications = require('loke-ipc').Communications;

var communications = new Communications(config);
communications.start()
.then(function() {
   console.log('Connected!');
});
```

Specify the location of RMQ:

```js
var lokeIpc = require('loke-ipc');

lokeIpc.connect('amqp://localhost')
.then(function(connection) {
   console.log('Connected!');
});
```


## Consuming Services

```js
var lokeIpc = require('loke-ipc');

lokeIpc.connect('amqp://localhost')
.then(function(connection) {
   return connection.getRpcClient();
})
.then(function(client) {
    client.request(/* ... */);
    // ...
});
```

Or use installed service manifests (see [ipc-install](#ipc-install)):

```
$ ipc-install some-service@1
```

then

```js
var lokeIpc = require('loke-ipc');

lokeIpc.connect('amqp://localhost')
.then(function(connection) {
  return connection.getRpcClient();
})
.then(function(client) {
  var someService = client.load('some-service');
  someService.doSomething(/*...*/);
});
```

## Publishing Services

TODO: see the following methods:

exposeService
exposeServices
closeServices

```js


```

## More

A custom logger can be provided. If none is provided then console will be used.

```js
var lokeIpc = require('loke-ipc');

lokeIpc.connect(null, myCustomerLogger)
.then(function(connection) {
   console.log('Connected!');
});
```

## CLI

The cli tools are configured using [rc](https://github.com/dominictarr/rc).
This means config variables can be set in

- `~/.ipcrc`
- `./.ipcrc` (current directory, probably you project directory)

or by using a command line flag

```
--ipc_amqpuri='amqp://somehost'
```

**The currently available variables are:**

- `amqpuri` the amqp server to connect to

### ipc-install

```
Usage: ipc-install <service>...

<service>    in the format serviceName@version
```

example

```
$ ipc-install orders@1
writing... /my/project/ipc_manifests/orders.json
```

### ipc-repl

```
Usage: ipc-repl
```

example

```
$ ipc-repl
ipc> orders.ping()
'pong'
ipc>
```
