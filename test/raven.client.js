/* eslint no-shadow:0, consistent-return:0, no-console:0 */
/* global Promise */
'use strict';

var raven = require('../'),
    nock = require('nock'),
    url = require('url'),
    zlib = require('zlib');

raven.utils.disableConsoleAlerts();

var dsn = 'https://public:private@app.getsentry.com/269';

var _oldConsoleWarn = console.warn;

function mockConsoleWarn() {
  console.warn = function () {
    console.warn._called = true;
  };
  console.warn._called = false;
}

function restoreConsoleWarn() {
  console.warn = _oldConsoleWarn;
}

describe('raven.version', function () {
  it('should be valid', function () {
    raven.version.should.match(/^\d+\.\d+\.\d+(-\w+(\.\d+)?)?$/);
  });

  it('should match package.json', function () {
    var version = require('../package.json').version;
    raven.version.should.equal(version);
  });
});

describe('raven.Client', function () {
  var client;
  beforeEach(function () {
    client = new raven.Client(dsn);
  });

  it('should parse the DSN with options', function () {
    var expected = {
      protocol: 'https',
      public_key: 'public',
      private_key: 'private',
      host: 'app.getsentry.com',
      path: '/',
      project_id: '269',
      port: 443
    };
    var client = new raven.Client(dsn, {
      name: 'YAY!'
    });
    client.dsn.should.eql(expected);
    client.name.should.equal('YAY!');
  });

  it('should pull SENTRY_DSN from environment', function () {
    var expected = {
      protocol: 'https',
      public_key: 'abc',
      private_key: '123',
      host: 'app.getsentry.com',
      path: '/',
      project_id: '1',
      port: 443
    };
    process.env.SENTRY_DSN = 'https://abc:123@app.getsentry.com/1';
    var client = new raven.Client();
    client.dsn.should.eql(expected);
    delete process.env.SENTRY_DSN; // gotta clean up so it doesn't leak into other tests
  });

  it('should pull SENTRY_DSN from environment when passing options', function () {
    var expected = {
      protocol: 'https',
      public_key: 'abc',
      private_key: '123',
      host: 'app.getsentry.com',
      path: '/',
      project_id: '1',
      port: 443
    };
    process.env.SENTRY_DSN = 'https://abc:123@app.getsentry.com/1';
    var client = new raven.Client({
      name: 'YAY!'
    });
    client.dsn.should.eql(expected);
    client.name.should.equal('YAY!');
    delete process.env.SENTRY_DSN; // gotta clean up so it doesn't leak into other tests
  });

  it('should be disabled when no DSN specified', function () {
    mockConsoleWarn();
    var client = new raven.Client();
    client._enabled.should.eql(false);
    console.warn._called.should.eql(false);
    restoreConsoleWarn();
  });

  it('should pull SENTRY_NAME from environment', function () {
    process.env.SENTRY_NAME = 'new_name';
    var client = new raven.Client(dsn);
    client.name.should.eql('new_name');
    delete process.env.SENTRY_NAME;
  });

  it('should be disabled for a falsey DSN', function () {
    mockConsoleWarn();
    var client = new raven.Client(false);
    client._enabled.should.eql(false);
    console.warn._called.should.eql(false);
    restoreConsoleWarn();
  });

  it('should pull release from options if present', function () {
    var client = new raven.Client(dsn, {
      release: 'version1'
    });
    client.release.should.eql('version1');
  });

  it('should pull SENTRY_RELEASE from environment', function () {
    process.env.SENTRY_RELEASE = 'version1';
    var client = new raven.Client(dsn);
    client.release.should.eql('version1');
    delete process.env.SENTRY_RELEASE;
  });

  it('should pull environment from options if present', function () {
    var client = new raven.Client(dsn, {
      environment: 'staging'
    });
    client.environment.should.eql('staging');
  });

  it('should pull SENTRY_ENVIRONMENT from environment', function () {
    process.env.SENTRY_ENVIRONMENT = 'staging';
    var client = new raven.Client(dsn);
    client.environment.should.eql('staging');
    delete process.env.SENTRY_ENVIRONMENT;
  });

  describe('#getIdent()', function () {
    it('should match', function () {
      var result = 'c988bf5cb7db4653825c92f6864e7206';
      client.getIdent(result).should.equal('c988bf5cb7db4653825c92f6864e7206');
    });
  });

  describe('#captureMessage()', function () {
    it('should send a plain text message to Sentry server', function (done) {
      var scope = nock('https://app.getsentry.com')
        .filteringRequestBody(/.*/, '*')
        .post('/api/269/store/', '*')
        .reply(200, 'OK');

      client.on('logged', function () {
        scope.done();
        done();
      });
      client.captureMessage('Hey!');
    });

    it('should emit error when request returns non 200', function (done) {
      var scope = nock('https://app.getsentry.com')
        .filteringRequestBody(/.*/, '*')
        .post('/api/269/store/', '*')
        .reply(500, 'Oops!');

      client.on('error', function () {
        scope.done();
        done();
      });
      client.captureMessage('Hey!');
    });

    it('shouldn\'t shit it\'s pants when error is emitted without a listener', function () {
      nock('https://app.getsentry.com')
        .filteringRequestBody(/.*/, '*')
        .post('/api/269/store/', '*')
        .reply(500, 'Oops!');

      client.captureMessage('Hey!');
    });

    it('should attach an Error object when emitting error', function (done) {
      var scope = nock('https://app.getsentry.com')
        .filteringRequestBody(/.*/, '*')
        .post('/api/269/store/', '*')
        .reply(500, 'Oops!', {
          'x-sentry-error': 'Oops!'
        });

      client.on('error', function (e) {
        e.statusCode.should.eql(500);
        e.reason.should.eql('Oops!');
        e.response.should.be.ok;
        scope.done();
        done();
      });

      client.captureMessage('Hey!');
    });
  });

  describe('#captureError()', function () {
    it('should send an Error to Sentry server', function (done) {
      var scope = nock('https://app.getsentry.com')
        .filteringRequestBody(/.*/, '*')
        .post('/api/269/store/', '*')
        .reply(200, 'OK');

      client.on('logged', function () {
        scope.done();
        done();
      });
      client.captureError(new Error('wtf?'));
    });

    it('should send a plain text "error" with a synthesized stack', function (done) {
      var old = client.send;
      client.send = function mockSend(kwargs) {
        client.send = old;

        kwargs.message.should.equal('Error: wtf?');
        kwargs.should.have.property('exception');
        var stack = kwargs.exception[0].stacktrace;
        stack.frames[stack.frames.length - 1].function.should.equal('Raven.captureException');
        done();
      };
      client.captureException('wtf?');
    });

    it('should send an Error to Sentry server on another port', function (done) {
      var scope = nock('https://app.getsentry.com:8443')
        .filteringRequestBody(/.*/, '*')
        .post('/api/269/store/', '*')
        .reply(200, 'OK');

      var dsn = 'https://public:private@app.getsentry.com:8443/269';
      var client = new raven.Client(dsn);
      client.on('logged', function () {
        scope.done();
        done();
      });
      client.captureError(new Error('wtf?'));
    });

    it('shouldn\'t choke on circular references', function (done) {
      // See: https://github.com/mattrobenolt/raven-node/pull/46
      var old = zlib.deflate;
      zlib.deflate = function mockSend(skwargs) {
        zlib.deflate = old;

        var kwargs = JSON.parse(skwargs);
        kwargs.should.have.property('extra', {
          foo: '[Circular ~]'
        });
        done();
      };

      // create circular reference
      var kwargs = {
        extra: {
          foo: null
        }
      };
      kwargs.extra.foo = kwargs;
      client.captureError(new Error('wtf?'), kwargs);
    });
  });

  describe('#install()', function () {
    beforeEach(function () {
      process.removeAllListeners('uncaughtException');
      process.removeAllListeners('unhandledRejection');
    });

    afterEach(function () {
      process.removeAllListeners('uncaughtException');
      process.removeAllListeners('unhandledRejection');
    });

    it('should not listen for unhandledRejection unless told to', function () {
      var listeners = process.listeners('unhandledRejection');
      listeners.length.should.equal(0);

      client.install();

      listeners = process.listeners('unhandledRejection');
      listeners.length.should.equal(0);
    });

    it('should catch an unhandledRejection', function (done) {
      var listeners = process.listeners('unhandledRejection');
      listeners.length.should.equal(0);

      client = new raven.Client(dsn, { captureUnhandledRejections: true });
      client.install(function (sent, reason) {
        reason.message.should.equal('rejected!');
        done();
      });

      listeners = process.listeners('unhandledRejection');
      listeners.length.should.equal(1);

      // promises didn't fire unhandledRejection until 1.4.1
      if (process.version >= 'v1.4.1') {
        // eslint-disable-next-line no-new
        new Promise(function (resolve, reject) {
          reject(new Error('rejected!'));
        });
      } else {
        process.emit('unhandledRejection', new Error('rejected!'));
      }
    });
  });

  describe('#patchGlobal()', function () {
    beforeEach(function () {
      // remove existing uncaughtException handlers
      this.uncaughtBefore = process.listeners('uncaughtException');
      process.removeAllListeners('uncaughtException');
    });

    afterEach(function () {
      process.removeAllListeners('uncaughtException');
      var uncaughtBefore = this.uncaughtBefore;
      // restore things to how they were
      for (var i = 0; i < uncaughtBefore.length; i++) {
        process.on('uncaughtException', uncaughtBefore[i]);
      }
    });

    it('should add itself to the uncaughtException event list', function () {
      var listeners = process.listeners('uncaughtException');
      listeners.length.should.equal(0);

      client.patchGlobal();

      listeners = process.listeners('uncaughtException');
      listeners.length.should.equal(1);
    });

    it('should send an uncaughtException to Sentry server', function (done) {
      var scope = nock('https://app.getsentry.com')
        .filteringRequestBody(/.*/, '*')
        .post('/api/269/store/', '*')
        .reply(200, 'OK');

      client.on('logged', function () {
        scope.done();
        done();
      });
      client.patchGlobal();
      process.emit('uncaughtException', new Error('derp'));
    });

    it('should trigger a callback after an uncaughtException', function (done) {
      var scope = nock('https://app.getsentry.com')
        .filteringRequestBody(/.*/, '*')
        .post('/api/269/store/', '*')
        .reply(200, 'OK');

      client.patchGlobal(function () {
        scope.done();
        done();
      });
      process.emit('uncaughtException', new Error('derp'));
    });

    it('should not enter in recursion when an error is thrown on client request', function (done) {
      var transportBefore = client.transport.send;

      client.transport.send = function () {
        throw new Error('foo');
      };

      client.patchGlobal(function (success, err) {
        success.should.eql(false);
        err.should.be.instanceOf(Error);
        err.message.should.equal('foo');

        client.transport.send = transportBefore;

        done();
      });


      process.emit('uncaughtException', new Error('derp'));
    });
  });

  describe('#process()', function () {
    it('should respect dataCallback', function (done) {
      var scope = nock('https://app.getsentry.com')
        .filteringRequestBody(/.*/, '*')
        .post('/api/269/store/', '*')
        .reply(200, function (uri, body) {
          zlib.inflate(new Buffer(body, 'base64'), function (err, dec) {
            if (err) return done(err);
            var msg = JSON.parse(dec.toString());
            var extra = msg.extra;

            extra.should.not.have.property('foo');
            done();
          });
          return 'OK';
        });

      client = new raven.Client(dsn, {
        dataCallback: function (data) {
          delete data.extra.foo;
          return data;
        }
      });

      client.process({
        message: 'test',
        extra: {
          foo: 'bar'
        }
      });

      client.on('logged', function () {
        scope.done();
      });
    });

    it('should respect shouldSendCallback', function (done) {
      client = new raven.Client(dsn, {
        shouldSendCallback: function (data) {
          return false;
        }
      });

      // neither of these should fire, so report err to done if they do
      client.on('logged', done);
      client.on('error', done);

      client.process({
        message: 'test'
      }, function (err, eventId) {
        setTimeout(done, 10);
      });
    });

    it('should pass original shouldSendCallback to newer shouldSendCallback', function (done) {
      var cb1 = function (data) {
        return false;
      };

      var cb2 = function (data, original) {
        original.should.equal(cb1);
        return original(data);
      };

      var cb3 = function (data, original) {
        return original(data);
      };

      client = new raven.Client(dsn, {
        shouldSendCallback: cb1,
      });

      client.setShouldSendCallback(cb2);
      client.setShouldSendCallback(cb3);

      // neither of these should fire, so report err to done if they do
      client.on('logged', done);
      client.on('error', done);

      client.process({
        message: 'test'
      }, function (err, eventId) {
        setTimeout(done, 10);
      });
    });

    it('should pass original dataCallback to newer dataCallback', function (done) {
      var scope = nock('https://app.getsentry.com')
        .filteringRequestBody(/.*/, '*')
        .post('/api/269/store/', '*')
        .reply(200, function (uri, body, cb) {
          zlib.inflate(new Buffer(body, 'base64'), function (err, dec) {
            if (err) return done(err);
            var msg = JSON.parse(dec.toString());
            msg.extra.foo.should.equal('bar');
            cb(null, 'OK');
          });
        });

      var cb1 = function (data) {
        data.extra = { foo: 'bar' };
        return data;
      };

      var cb2 = function (data, original) {
        original.should.equal(cb1);
        return original(data);
      };

      var cb3 = function (data, original) {
        return original(data);
      };

      client = new raven.Client(dsn, {
        dataCallback: cb1,
      });

      client.setDataCallback(cb2);
      client.setDataCallback(cb3);

      client.process({
        message: 'test'
      }, function (err, eventId) {
        scope.done();
        done();
      });
    });

    it('should call the callback after sending', function (done) {
      var firedCallback = false;
      var sentResponse = false;
      var scope = nock('https://app.getsentry.com')
        .filteringRequestBody(/.*/, '*')
        .post('/api/269/store/', '*')
        .delay(10)
        .reply(200, function (uri, body) {
          zlib.inflate(new Buffer(body, 'base64'), function (err, dec) {
            if (err) return done(err);
            var msg = JSON.parse(dec.toString());
            msg.message.should.equal('test');
          });
          firedCallback.should.equal(false);
          sentResponse = true;
          return 'OK';
        });

      client = new raven.Client(dsn);

      client.process({
        message: 'test',
      }, function () {
        firedCallback = true;
        sentResponse.should.equal(true);
        scope.done();
        done();
      });
    });

    it('should attach environment', function (done) {
      client = new raven.Client(dsn, {
        environment: 'staging'
      });
      client.send = function (kwargs) {
        kwargs.environment.should.equal('staging');
      };
      client.process({ message: 'test' });

      client.send = function (kwargs) {
        kwargs.environment.should.equal('production');
        done();
      };
      client.process({
        message: 'test',
        environment: 'production'
      });
    });
  });

  it('should use a custom transport', function () {
    var expected = {
      protocol: 'https',
      public_key: 'public',
      private_key: 'private',
      host: 'app.getsentry.com',
      path: '/',
      project_id: '269',
      port: 443
    };
    var dsn = 'heka+https://public:private@app.getsentry.com/269';
    var client = new raven.Client(dsn, {
      transport: 'some_heka_instance'
    });
    client.dsn.should.eql(expected);
    client.transport.should.equal('some_heka_instance');
  });

  it('should use a DSN subpath when sending requests', function (done) {
    var dsn = 'https://public:private@app.getsentry.com/some/path/269';
    var client = new raven.Client(dsn);

    var scope = nock('https://app.getsentry.com')
      .filteringRequestBody(/.*/, '*')
      .post('/some/path/api/269/store/', '*')
      .reply(200, 'OK');

    client.on('logged', function () {
      scope.done();
      done();
    });
    client.captureMessage('Hey!');
  });

  it('should capture module information', function (done) {
    var scope = nock('https://app.getsentry.com')
      .filteringRequestBody(/.*/, '*')
      .post('/api/269/store/', '*')
      .reply(200, function (uri, body) {
        zlib.inflate(new Buffer(body, 'base64'), function (err, dec) {
          if (err) return done(err);
          var msg = JSON.parse(dec.toString());
          var modules = msg.modules;

          modules.should.have.property('lsmod');
          modules.should.have.property('uuid');
          done();
        });
        return 'OK';
      });

    client.on('logged', function () {
      scope.done();
    });
    client.captureError(new Error('wtf?'));
  });

  it('should capture extra data', function (done) {
    client = new raven.Client(dsn, {
      extra: {
        globalContextKey: 'globalContextValue'
      }
    });

    var scope = nock('https://app.getsentry.com')
      .filteringRequestBody(/.*/, '*')
      .post('/api/269/store/', '*')
      .reply(200, function (uri, body) {
        zlib.inflate(new Buffer(body, 'base64'), function (err, dec) {
          if (err) return done(err);
          var msg = JSON.parse(dec.toString());
          var extra = msg.extra;

          extra.should.have.property('key');
          extra.key.should.equal('value');
          extra.should.have.property('globalContextKey');
          extra.globalContextKey.should.equal('globalContextValue');

          done();
        });
        return 'OK';
      });

    client.on('logged', function () {
      scope.done();
    });
    client.process({
      message: 'test',
      extra: {
        key: 'value'
      }
    });
  });

  it('should capture tags', function (done) {
    client = new raven.Client(dsn, {
      tags: {
        globalContextKey: 'globalContextValue'
      }
    });
    var scope = nock('https://app.getsentry.com')
      .filteringRequestBody(/.*/, '*')
      .post('/api/269/store/', '*')
      .reply(200, function (uri, body) {
        zlib.inflate(new Buffer(body, 'base64'), function (err, dec) {
          if (err) return done(err);
          var msg = JSON.parse(dec.toString());
          var tags = msg.tags;

          tags.should.have.property('key');
          tags.key.should.equal('value');
          tags.should.have.property('globalContextKey');
          tags.globalContextKey.should.equal('globalContextValue');

          done();
        });
        return 'OK';
      });

    client.on('logged', function () {
      scope.done();
    });
    client.process({
      message: 'test',
      tags: {
        key: 'value'
      }
    });
  });

  it('should capture fingerprint', function (done) {
    var scope = nock('https://app.getsentry.com')
      .filteringRequestBody(/.*/, '*')
      .post('/api/269/store/', '*')
      .reply(200, function (uri, body) {
        zlib.inflate(new Buffer(body, 'base64'), function (err, dec) {
          if (err) return done(err);
          var msg = JSON.parse(dec.toString());

          msg.fingerprint.length.should.equal(1);
          msg.fingerprint[0].should.equal('foo');

          done();
        });
        return 'OK';
      });

    client.on('logged', function () {
      scope.done();
    });
    client.process({
      message: 'test',
      fingerprint: ['foo']
    });
  });

  it('should capture user', function (done) {
    var scope = nock('https://app.getsentry.com')
        .filteringRequestBody(/.*/, '*')
        .post('/api/269/store/', '*')
        .reply(200, function (uri, body) {
          zlib.inflate(new Buffer(body, 'base64'), function (err, dec) {
            if (err) return done(err);
            var msg = JSON.parse(dec.toString());

            msg.user.should.have.property('email', 'matt@example.com');
            msg.user.should.have.property('id', '123');

            done();
          });
          return 'OK';
        });

    var client = new raven.Client(dsn, {
      release: 'version1'
    });

    client.setContext({
      user: {
        email: 'matt@example.com',
        id: '123'
      }
    });

    client.on('logged', function () {
      scope.done();
    });
    client.process({
      message: 'test'
    });
  });

  it('should capture release', function (done) {
    var scope = nock('https://app.getsentry.com')
      .filteringRequestBody(/.*/, '*')
      .post('/api/269/store/', '*')
      .reply(200, function (uri, body) {
        zlib.inflate(new Buffer(body, 'base64'), function (err, dec) {
          if (err) return done(err);
          var msg = JSON.parse(dec.toString());

          msg.release.should.equal('version1');

          done();
        });
        return 'OK';
      });

    var client = new raven.Client(dsn, {
      release: 'version1'
    });
    client.on('logged', function () {
      scope.done();
    });
    client.process({
      message: 'test'
    });
  });

  describe('#setContext', function () {
    afterEach(function () {
      process.domain && process.domain.exit();
    });

    it('should merge contexts in correct hierarchy', function (done) {
      var scope = nock('https://app.getsentry.com')
        .filteringRequestBody(/.*/, '*')
        .post('/api/269/store/', '*')
        .reply(200, function (uri, body) {
          zlib.inflate(new Buffer(body, 'base64'), function (err, dec) {
            if (err) return done(err);
            var msg = JSON.parse(dec.toString());

            msg.user.should.eql({
              a: 1,
              b: 2,
              c: 3
            });

            done();
          });
          return 'OK';
        });

      client.setContext({
        user: {
          a: 1,
          b: 1,
          c: 1
        }
      });

      client.context(function () {
        client.setContext({
          user: {
            b: 2,
            c: 2
          }
        });
        client.captureException(new Error('foo'), {
          user: {
            c: 3
          }
        }, function () {
          scope.done();
        });
      });
    });
  });

  describe('#intercept()', function () {
    it('should catch an err param', function (done) {
      var scope = nock('https://app.getsentry.com')
        .filteringRequestBody(/.*/, '*')
        .post('/api/269/store/', '*')
        .reply(200, function (uri, body) {
          zlib.inflate(new Buffer(body, 'base64'), function (err, dec) {
            if (err) return done(err);
            var msg = JSON.parse(dec.toString());
            msg.message.indexOf('foo').should.not.equal(-1);
            done();
          });
          return 'OK';
        });

      client.on('logged', function () {
        scope.done();
      });

      client.interceptErr(function (err) {
        done(new Error('called wrapped function'));
      })(new Error('foo'));
    });

    it('should pass options to captureException', function (done) {
      var scope = nock('https://app.getsentry.com')
        .filteringRequestBody(/.*/, '*')
        .post('/api/269/store/', '*')
        .reply(200, function (uri, body) {
          zlib.inflate(new Buffer(body, 'base64'), function (err, dec) {
            if (err) return done(err);
            var msg = JSON.parse(dec.toString());
            msg.message.indexOf('foo').should.not.equal(-1);
            msg.extra.foo.should.equal('bar');
            done();
          });
          return 'OK';
        });

      client.on('logged', function () {
        scope.done();
      });

      client.interceptErr({ extra: { foo: 'bar' } }, function (err) {
        done(new Error('called wrapped function'));
      })(new Error('foo'));
    });

    it('should call original when no err', function (done) {
      client.interceptErr(function (err, result) {
        if (err != null) return done(err);
        result.should.equal('result');
        done();
      })(null, 'result');
    });
  });

  describe('#captureBreadcrumb', function () {
    beforeEach(function () {
      mockConsoleWarn();
    });

    afterEach(function () {
      client.uninstall();
      restoreConsoleWarn();
    });

    it('should capture a breadcrumb', function (done) {
      var message = 'test breadcrumb';
      client.install();
      client.context(function () {
        client.captureBreadcrumb({
          category: 'test',
          message: message
        });
        client.getContext().should.not.equal(client._globalContext);
        client.getContext().breadcrumbs[0].message.should.equal(message);
      });
      done();
    });

    it('should capture breadcrumbs at global context level', function (done) {
      var message = 'test breadcrumb';
      client = new raven.Client(dsn, {
        shouldSendCallback: function (data) {
          data.breadcrumbs.values.length.should.equal(1);
          done();
        }
      });
      client.install();
      client.captureBreadcrumb({
        category: 'test',
        message: message
      });
      client.captureException(new Error('oh no'));
    });

    it('should instrument console to capture breadcrumbs', function (done) {
      client = new raven.Client(dsn, { autoBreadcrumbs: { console: true } });
      client.install();

      client.context(function () {
        console.warn('breadcrumb!');
        client.getContext().breadcrumbs[0].message.should.equal('breadcrumb!');
        done();
      });
    });

    it('should not die trying to instrument a missing module', function (done) {
      client = new raven.Client(dsn, { autoBreadcrumbs: { pg: true } });
      client.install();
      done();
    });

    describe('http breadcrumbs', function () {
      beforeEach(function () {
        client = new raven.Client(dsn, { autoBreadcrumbs: { http: true } });
        client.install();
      });

      it('should instrument http to capture breadcrumbs', function (done) {
        var testUrl = 'http://example.com/';
        var scope = nock(testUrl)
          .get('/')
          .reply(200, 'OK');

        client.context(function () {
          var http = require('http');
          http.get(url.parse(testUrl), function (response) {
            response._readableState.should.have.property('flowing', null);
            // need to wait a tick here because nock will make this callback fire
            // before our req.emit monkeypatch captures the breadcrumb :/
            setTimeout(function () {
              response._readableState.should.have.property('flowing', null);
              client.getContext().breadcrumbs[0].data.url.should.equal(testUrl);
              client.getContext().breadcrumbs[0].data.status_code.should.equal(200);
              scope.done();
              done();
            }, 0);
          });
        });
      });

      it('should instrument https to capture breadcrumbs', function (done) {
        var testUrl = 'https://example.com/';
        var scope = nock(testUrl)
          .get('/')
          .reply(200, 'OK');

        client.context(function () {
          var https = require('https');
          https.get(url.parse(testUrl), function (response) {
            response._readableState.should.have.property('flowing', null);
            // need to wait a tick here because nock will make this callback fire
            // before our req.emit monkeypatch captures the breadcrumb :/
            setTimeout(function () {
              response._readableState.should.have.property('flowing', null);
              client.getContext().breadcrumbs[0].data.url.should.equal(testUrl);
              client.getContext().breadcrumbs[0].data.status_code.should.equal(200);
              scope.done();
              done();
            }, 0);
          });
        });
      });

      it('should not capture breadcrumbs for requests to sentry', function (done) {
        var scope = nock('https://app.getsentry.com')
          .filteringRequestBody(/.*/, '*')
          .post('/api/269/store/', '*')
          .reply(200, 'OK');

        client.context(function () {
          client.captureException(new Error('test'), function () {
            // need to wait a tick because the response handler that captures the breadcrumb might run after this one
            setTimeout(function () {
              client.getContext().should.not.have.key('breadcrumbs');
              scope.done();
              done();
            }, 0);
          });
        });
      });
    });
  });
});

describe('raven.middleware', function () {
  it('should use an instance passed to it instead of making a new one', function () {
    var client = new raven.Client(dsn);
    raven.middleware.express.getClient(client).should.equal(client);
  });

  it('should make a new instance when passed a DSN string', function () {
    var client1 = new raven.Client(dsn);
    var client2 = raven.middleware.express.getClient(dsn);
    client2.should.not.equal(raven);
    client2.should.not.equal(client1);
    client2.should.be.an.instanceof(raven.constructor);
  });

  it('should explicitly add req and res to the domain', function (done) {
    var client = new raven.Client(dsn).install();
    var message = 'test breadcrumb';

    var EventEmitter = require('events');
    if (process.version <= 'v0.11') EventEmitter = EventEmitter.EventEmitter; // node 0.10 compat
    var e = new EventEmitter();
    e.on('done', function () {
      // Context won't propagate here without the explicit binding of req/res done in the middleware
      setTimeout(function () {
        client.getContext().breadcrumbs.length.should.equal(1);
        client.getContext().breadcrumbs[0].message.should.equal(message);
        done();
      }, 0);
    });

    // Pass e as the req/res, so e will be added to the domain
    client.requestHandler()(e, e, function () {
      client.captureBreadcrumb({
        message: message,
        category: 'log'
      });
      setTimeout(function () {
        e.emit('done');
      }, 0);
    });
  });
});
