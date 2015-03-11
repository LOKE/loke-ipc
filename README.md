# Sumo Communications

## Connecting

```js
var sumoComms = require('sumo-communications');

sumoComms.connect()
.then(function(connection) {
   console.log('Connected!'); 
});
```

Alternatively use the constructor:
```js
var Communications = require('sumo-communications').Communications;

var communications = new Communications(config);
communications.start()
.then(function() {
   console.log('Connected!'); 
});
```

Specify the location of RMQ:

```js
var sumoComms = require('sumo-communications');

sumoComms.connect('amqp://localhost')
.then(function(connection) {
   console.log('Connected!'); 
});
```


## Consuming Services

```js
var sumoComms = require('sumo-communications');

sumoComms.connect('amqp://localhost')
.then(function(connection) {
   return connection.getRpcClient();
})
.then(function(client) {
    client.request(/* ... */);
    // ...
});
```

Or use the service builder:

```js
var sumoComms = require('sumo-communications');

sumoComms.connect('amqp://localhost')
.then(function(connection) {
   return connection.getRpcClient();
})
.then(function(client) {
    client.request(/* ... */);
    // ...
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
var sumoComms = require('sumo-communications');

sumoComms.connect(null, myCustomerLogger)
.then(function(connection) {
   console.log('Connected!'); 
});
```
