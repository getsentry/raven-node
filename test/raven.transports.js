'use strict';

var transports = require('../lib/transports');

describe('transports', function() {
  it('should have an http/s agent with correct config attached by default', function() {
    var http = transports.http;
    http.agent.should.exist;
    http.agent.keepAlive.should.equal(true);
    http.agent.maxSockets.should.equal(100);

    var https = transports.https;
    https.agent.should.exist;
    https.agent.keepAlive.should.equal(true);
    https.agent.maxSockets.should.equal(100);
  });

  it('should set proxy agent when proxy config is specified and request is sent', function(done) {
    var option = {
      proxyHost: 'localhost',
      proxyPort: '8080'
    };

    // HTTP
    var httpProxyTransport = new transports.HTTPProxyTransport(option);
    httpProxyTransport.options.host.should.equal('localhost');
    httpProxyTransport.options.port.should.equal('8080');

    // HTTPS
    var httpsProxyTransport = new transports.HTTPSProxyTransport(option);
    httpsProxyTransport.options.agent.proxyOptions.should.exist;

    var _cachedAgent = httpProxyTransport.agent;
    var requests = {};
    for (var i = 0; i < 10; i++) {
      requests[i] = 'req';
    }

    httpProxyTransport.agent = Object.assign({}, _cachedAgent, {
      getName: function() {
        return 'foo:123';
      },
      requests: {
        'foo:123': requests
      }
    });

    httpsProxyTransport.send(
      {
        dsn: {
          host: 'foo',
          port: 123
        },
        emit: function() {}
      },
      null,
      null,
      null,
      function() {
        httpsProxyTransport.options.agent.proxyOptions.headers.host.should.exist;
        done();
      }
    );

    httpProxyTransport.send(
      {
        dsn: {
          host: 'foo',
          port: 123,
          protocol: 'http'
        },
        emit: function() {}
      },
      null,
      null,
      null,
      function() {
        httpProxyTransport.options.path.should.contain('foo:123');
        done();
      }
    );
  });

  it('should emit error when requests queued over the limit', function(done) {
    var http = transports.http;
    var _cachedAgent = http.options.agent;

    var requests = {};
    for (var i = 0; i < 10; i++) {
      requests[i] = 'req';
    }

    http.agent = Object.assign({}, _cachedAgent, {
      getName: function() {
        return 'foo:123';
      },
      requests: {
        'foo:123': requests
      }
    });

    http.send({
      dsn: {
        host: 'foo',
        port: 123
      },
      maxReqQueueCount: 5,
      emit: function(event, body) {
        event.should.equal('error');
        body.message.should.equal('client req queue is full..');
        http.options.agent = _cachedAgent;
        done();
      }
    });
  });
});
