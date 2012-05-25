# Raven [![Build Status](https://secure.travis-ci.org/mattrobenolt/raven-node.png?branch=master)](http://travis-ci.org/mattrobenolt/raven-node)
Log errors and stack traces in [Sentry](http://getsentry.com/) from within your Node.js applications. Includes middleware support for [Connect](http://www.senchalabs.org/connect/)/[Express](http://expressjs.com/).

All processing and sending happens asynchronously to not slow things down if/when Sentry is down or slow.

## Installation
```
$ npm install raven
```

## Basic Usage
```javascript
var raven = require('raven');
var client = new raven.Client('{{ SENTRY_DSN }}');

client.captureMessage('Hello, world!');
```

Run with:
```
$ NODE_ENV=production node script.js
```

## Logging an error
```javascript
client.captureError(new Error('Broke!'));
```

## Logging a query
```javascript
client.captureQuery('SELECT * FROM `awesome`', 'mysql');
```

## Sentry Identifier
```javascript
client.captureMessage('Hello, world!', function(result) {
    console.log(client.getIdent(result));
});
```

```javascript
client.captureError(new Error('Broke!'), function(result) {
  console.log(client.getIdent(result));
});
```

__Note__: `client.captureMessage` will also return the result directly without the need for a callback, such as: `var result = client.captureMessage('Hello, world!');`

## Additional data
You might want to send additional data to sentry, which will help to understand the error. Therefore you should use `extra` property of the object passed as a second optional parameter. If you add user specific data to the message, event will not grouped by sentry.

```javascript
client.captureMessage('Hello, world!', {extra: {userId: 123}}, function(result) {
    console.log(client.getIdent(result));
});

client.captureError(new Error('Broke!'), {extra: {userId: 123}});
```
## Events
If you really care if the event was logged or errored out, Client emits two events, `logged` and `error`:

```javascript
client.on('logged', function(){
  console.log('Yay, it worked!');
});
client.on('error', function(){
  console.log('oh well, Sentry is broke.');
})
client.captureMessage('Boom');
```

## Environment variables
### NODE_ENV
`NODE_ENV` must be set to `production` for Sentry to actually work. Without being in production, a warning is issued and logging disabled.

### SENTRY_DSN
Optionally declare the DSN to use for the client through the environment. Initializing the client in your app won't require setting the DSN.

### SENTRY_NAME
Optionally set the name for the client to use. [What is name?](http://raven.readthedocs.org/en/latest/config/index.html#name)

### SENTRY_SITE
Optionally set the site for the client to use. [What is site?](http://raven.readthedocs.org/en/latest/config/index.html#site)

## Catching global errors
For those times when you don't catch all errors in your application. ;)

```javascript
client.patchGlobal();
// or
raven.patchGlobal(client);
// or
raven.patchGlobal('{{ SENTRY_DSN }}');
```

## Methods
```javascript
new raven.Client(dsn[, options])
client.captureMessage(string[,callback])
client.captureError(Error[,callback])
client.captureQuery(string, string[,callback])
```

## Integrations
### Connect/Express middleware
The Raven middleware can be used as-is with either Connect or Express in the same way. Take note that in your middlewares, Raven must appear _after_ your main handler to pick up any errors that may result from handling a request.

#### Connect
```javascript
var connect = require('connect');
function mainHandler(req, res) {
  throw new Error('Broke!');
}
function onError(err, req, res, next) {
  // The error id is attached to `res.sentry` to be returned
  // and optionally displayed to the user for support.
  res.statusCode = 500;
  res.end(res.sentry+'\n');
}
connect(
  connect.bodyParser(),
  connect.cookieParser(),
  mainHandler,
  raven.middleware.connect('{{ SENTRY_DSN }}'),
  onError, // optional error handler if you want to display the error id to a user
).listen(3000);
```

#### Express
```javascript
var app = require('express').createServer();
app.error(raven.middleware.express('{{ SENTRY_DSN }}'));
app.error(onError); // optional error handler if you want to display the error id to a user
app.get('/', function mainHandler(req, res) {
  throw new Error('Broke!');
});
app.listen(3000);
```

## Todo
 * More complete test coverage
 * More comments in code
 * More third party integration
