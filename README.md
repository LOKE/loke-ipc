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

## RPC Events

When exposing RPC methods a number of events are fired from the RPC client to assist with logging and debugging.

```js
var lokeIpc = require('loke-ipc');

lokeIpc.connect('amqp://localhost')
.then(function(connection) {
  return connection.getRpcClient();
})
.then(function(client) {
  client.on('request:start', doStuff);
  client.on('request:complete', doStuff);
  client.on('request:error', doStuff);
});
```

For the following events a request object is of type:

```js
{
  id: 1,  // message ID
  method: 'myMethodName', // method name
  params: [] // array[*] of params passed to the method
}
```

The response object is of type:

```js
{
  result: myResult, // response from the method (type: any)
  error: null,      // JSON-RPC error will be null if there is a result
  id: id            // the message ID from the request
}
```

In the event of an error:
```js
{
  result: null,   // null result in case of error
  error: {
    code: -32000, // JSON-RPC error code
    message: "Failed abysmally",  // error description
    data: {}      // additional details (inner error or exception)
  },
  id: id
}
```


### request:start

```js
client.on('request:start', function(e) {
  console.log(e.method); // the method name eg "getCustomers" (string)
  console.log(e.request); // the full request object
});
```

### request:complete

```js
client.on('request:start', function(e) {
  console.log(e.method); // the method name eg "getCustomers" (string)
  console.log(e.request); // the full request object
  console.log(e.response); // the full response object
  console.log(e.duration); // the duration of the request in milliseconds (double)
});
```

### request:error

```js
client.on('request:error', function(e) {
  // NOTE: method and request could be undefined depending on where error was thrown (ie: if before message was parsed)
  console.log(e.method); // the method name eg "getCustomers" (string)
  console.log(e.request); // the full request object
  console.log(e.error); // the error thrown (Error)
});
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
