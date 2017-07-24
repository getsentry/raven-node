Winston
===

.. code-block:: javascript

    const winston = require('winston');
    const Sentry = require('winston-raven-sentry');

    // for full documentation see:
    // <https://github.com/niftylettuce/winston-raven-sentry>
    const options = {
      dsn: 'https://******@sentry.io/12345',
      level: 'info'
    };

    const logger = new winston.Logger({
      transports: [
        new Sentry(options)
      ]
    });

    logger.info('hello world');

    logger.error(new Error('something happened!'));

    logger.info('something happened on the api', {
      tags: {
        component: 'api'
      }
    });

