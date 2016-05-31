Koa
===

.. code-block:: javascript

  var koa = require('koa');
  var raven = require('raven');
  var error = require('./error');

  var app = koa();
  var sentry = new raven.Client('___DSN___');

  // $this is the koa context, where $this.request will be (express/connect) 'req'
  app.on('error', function(err, $this) { // <-- koa context
      // need to parse manually otherwise no request info will be shown in Sentry Event
      var parsedReq = raven.parsers.parseRequest($this.request);
      sentry.captureException(err, parsedReq);
  });
  
  app.use(error); // use the below file to handle errors

  app.listen(8080);

When emitting error to app be sure to include koa context, which contains ``http req`` in ``this.request``

.. code-block:: javascript

  // error.js
  module.exports = function * (next){
      try {
          yield next;
      } catch (err) {
          this.status = err.status || 500;

          // return response to client
          switch (this.accepts('html', 'json')) {
              case 'json':
                  this.status = 200;
                  this.body = { error: err.message };
                  break;
              case 'html':
                  this.body = '<html><head></head><body>' + err.message + '</body></html>';
                  break;
              default:
                  this.body = err.message;
                  break;
          }

          // emit back to app, be sure to pass koa context, since 'context.request' will
          // be used to parse the request for inclusion in the Sentry event.
          this.app.emit('error', err, this); // <-- koa context
      }
  };
