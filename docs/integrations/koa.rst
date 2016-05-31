Koa
===

.. code-block:: javascript

  var koa = require('koa');
  var raven = require('raven');

  var app = koa();
  var sentry = new raven.Client('___DSN___');

  // $this is the koa context, where this.request will be (express) 'req'
  app.on('error', function(err, $this) { // <-- koa context
      // need to parse manually otherwise nor equest info will be show in Sentry Event
      var parsedReq = raven.parsers.parseRequest($this.request);
      sentry.captureException(err, parsedReq);
  });

  app.listen(8080);

When emitting error to app be sure to include koa context, which contains ``request`` on ``this.request``

.. code-block:: javascript


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

          // emit back to app, be sure to pass 'this', since 'this.request' will
          // be used to parse the request for inclusion in the Sentry event.
          this.app.emit('error', err, this); // <-- koa context
      }
  };
