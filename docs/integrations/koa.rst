Koa
===

.. code-block:: javascript

    const koa = require('koa');
    const Raven = require('raven');

    const app = koa();
    Raven.config('___DSN___').install();

    app.on('error', function (err) {
      Raven.captureException(err, function (err, eventId) {
        console.log('Reported error ' + eventId);
      });
    });

    app.listen(3000);
