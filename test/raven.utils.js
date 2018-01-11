/* eslint max-len:0 */
'use strict';

var raven = require('../');
var stringify = require('../vendor/json-stringify-safe');

describe('raven.utils', function() {
  describe('#parseDSN()', function() {
    it('should parse hosted Sentry DSN without path', function() {
      var dsn = raven.utils.parseDSN(
        'https://8769c40cf49c4cc58b51fa45d8e2d166:296768aa91084e17b5ac02d3ad5bc7e7@app.getsentry.com/269'
      );
      var expected = {
        protocol: 'https',
        public_key: '8769c40cf49c4cc58b51fa45d8e2d166',
        private_key: '296768aa91084e17b5ac02d3ad5bc7e7',
        host: 'app.getsentry.com',
        path: '/',
        project_id: '269',
        port: 443
      };
      dsn.should.eql(expected);
    });

    it('should parse http not on hosted Sentry with path', function() {
      var dsn = raven.utils.parseDSN(
        'http://8769c40cf49c4cc58b51fa45d8e2d166:296768aa91084e17b5ac02d3ad5bc7e7@mysentry.com/some/other/path/269'
      );
      var expected = {
        protocol: 'http',
        public_key: '8769c40cf49c4cc58b51fa45d8e2d166',
        private_key: '296768aa91084e17b5ac02d3ad5bc7e7',
        host: 'mysentry.com',
        path: '/some/other/path/',
        project_id: '269',
        port: 80
      };
      dsn.should.eql(expected);
    });

    it('should parse DSN with non-standard port', function() {
      var dsn = raven.utils.parseDSN(
        'https://8769c40cf49c4cc58b51fa45d8e2d166:296768aa91084e17b5ac02d3ad5bc7e7@mysentry.com:8443/some/other/path/269'
      );
      var expected = {
        protocol: 'https',
        public_key: '8769c40cf49c4cc58b51fa45d8e2d166',
        private_key: '296768aa91084e17b5ac02d3ad5bc7e7',
        host: 'mysentry.com',
        path: '/some/other/path/',
        project_id: '269',
        port: 8443
      };
      dsn.should.eql(expected);
    });

    it('should return false for a falsey dns', function() {
      raven.utils.parseDSN(false).should.eql(false);
      raven.utils.parseDSN('').should.eql(false);
    });

    it('show throw an Error on invalid transport protocol', function() {
      (function() {
        raven.utils.parseDSN(
          'noop://8769c40cf49c4cc58b51fa45d8e2d166:296768aa91084e17b5ac02d3ad5bc7e7@mysentry.com:1234/some/other/path/269'
        );
      }.should.throw());
    });

    it('should ignore a sub-transport protocol', function() {
      var dsn = raven.utils.parseDSN(
        'gevent+https://8769c40cf49c4cc58b51fa45d8e2d166:296768aa91084e17b5ac02d3ad5bc7e7@mysentry.com:8443/some/other/path/269'
      );
      var expected = {
        protocol: 'https',
        public_key: '8769c40cf49c4cc58b51fa45d8e2d166',
        private_key: '296768aa91084e17b5ac02d3ad5bc7e7',
        host: 'mysentry.com',
        path: '/some/other/path/',
        project_id: '269',
        port: 8443
      };
      dsn.should.eql(expected);
    });

    it('should parse DSN without private key', function() {
      var dsn = raven.utils.parseDSN(
        'https://8769c40cf49c4cc58b51fa45d8e2d166@mysentry.com:8443/some/other/path/269'
      );
      var expected = {
        protocol: 'https',
        public_key: '8769c40cf49c4cc58b51fa45d8e2d166',
        host: 'mysentry.com',
        path: '/some/other/path/',
        project_id: '269',
        port: 8443
      };
      dsn.should.eql(expected);
    });
  });

  describe('#parseAuthHeader()', function() {
    it('should parse all parameters', function() {
      var timestamp = 12345,
        apiKey = 'abc',
        apiSecret = 'xyz';
      var expected =
        'Sentry sentry_version=5, sentry_timestamp=12345, sentry_client=raven-node/' +
        raven.version +
        ', sentry_key=abc, sentry_secret=xyz';
      raven.utils.getAuthHeader(timestamp, apiKey, apiSecret).should.equal(expected);
    });

    it('should skip sentry_secret if apiSecret not provided', function() {
      var timestamp = 12345,
        apiKey = 'abc';
      var expected =
        'Sentry sentry_version=5, sentry_timestamp=12345, sentry_client=raven-node/' +
        raven.version +
        ', sentry_key=abc';
      raven.utils.getAuthHeader(timestamp, apiKey).should.equal(expected);
    });
  });

  describe('#parseStack()', function() {
    // needs new tests with a mock callsite object
    it('shouldnt barf on an invalid stack', function() {
      var parseStack = raven.utils.parseStack;
      var callback = function(frames) {
        frames.length.should.equal(0);
      };
      parseStack('lol', callback);
      parseStack(void 0, callback);
      parseStack([], callback);
      parseStack(
        [
          {
            lol: 1
          }
        ],
        callback
      );
    });

    it('should extract context from last stack line', function(done) {
      var parseStack = raven.utils.parseStack;
      var callback = function(frames) {
        var frame = frames.pop();

        /* verify that the frame has the properties: pre_context, context_line
        and post_context, which are valid for in-app stack lines only.*/
        frame.pre_context.should.be.an.instanceOf(Array);
        frame.context_line.should.be.type('string');
        frame.context_line.trim().should.endWith('undeclared_function();');
        frame.post_context.should.be.an.instanceOf(Array);

        frame.in_app.should.be.true;
        done();
      };
      try {
        // eslint-disable-next-line no-undef
        undeclared_function();
      } catch (e) {
        parseStack(e, callback);
      }
    });

    it('should trim long source line in surrounding source context', function(done) {
      var parseStack = raven.utils.parseStack;
      var callback = function(frames) {
        var frame = frames.pop();
        frame.in_app.should.be.true;

        var lineBefore = frame.pre_context[frame.pre_context.length - 1].trim();
        lineBefore.should.not.startWith('{snip}');
        lineBefore.should.endWith('{snip}');

        var lineOf = frame.context_line.trim();
        lineOf.should.startWith('{snip}');
        lineOf.should.endWith('{snip}');
        lineOf.length.should.equal(154); // 140 limit + 7 for `{snip} ` and ` {snip}`
        lineOf.should.containEql("throw new Error('boom');");

        var lineAfter = frame.post_context[0].trim();
        lineAfter.should.not.startWith('{snip}');
        lineAfter.should.endWith('{snip}');
        done();
      };
      try {
        require('./fixtures/long-line')();
      } catch (e) {
        parseStack(e, callback);
      }
    });

    it('should treat windows files as being in app: in_app should be true', function(
      done
    ) {
      var parseStack = raven.utils.parseStack;
      var callback = function(frames) {
        var frame = frames.pop();
        frame.filename.should.be.type('string');
        frame.filename.should.startWith('C:\\');
        frame.in_app.should.be.true;
        done();
      };
      var err = new Error('some error message');
      // get first line of err stack (line after err message)
      var firstFileLine = err.stack.split('\n')[1];
      // replace first occurrence of "/" with C:\ to mock windows style
      var winFirstFileLine = firstFileLine.replace(/[/]/, 'C:\\');
      // replace all remaining "/" with "\"
      winFirstFileLine = winFirstFileLine.replace(/[/]/g, '\\');
      // create a "win-style" stack replacing the first err.stack line with our above win-style line
      err.stack = err.stack.replace(firstFileLine, winFirstFileLine);
      parseStack(err, callback);
    });

    it('should mark node core library frames as not being in app', function(done) {
      var qsStringify = require('querystring').stringify;
      var parseStack = raven.utils.parseStack;

      var callback = function(frames) {
        // querystring was different back in old node, compat hack
        if (process.version < 'v4') frames.pop();

        var frame1 = frames.pop();
        frame1.in_app.should.be.false;
        frame1.filename.should.equal('querystring.js');

        var frame2 = frames.pop();
        frame2.in_app.should.be.false;
        frame2.filename.should.equal('querystring.js');

        done();
      };

      try {
        // Incomplete surrogate pair will cause qs.encode (used by qs.stringify) to throw
        qsStringify({a: '\uDCA9'});
      } catch (e) {
        parseStack(e, callback);
      }
    });

    it('should not read the same source file multiple times when getting source context lines', function(
      done
    ) {
      var fs = require('fs');
      var origReadFile = fs.readFile;
      var filesRead = [];

      fs.readFile = function(file) {
        filesRead.push(file);
        origReadFile.apply(this, arguments);
      };

      function parseCallback(frames) {
        // first two frames will both be from this file, but we should have only read this file once
        var frame1 = frames.pop();
        var frame2 = frames.pop();
        frame1.context_line.trim().should.endWith("throw new Error('error');");
        frame2.context_line.trim().should.endWith('nestedThrow();');
        frame1.filename.should.equal(frame2.filename);

        var uniqueFilesRead = filesRead.filter(function(filename, idx, arr) {
          return arr.indexOf(filename) === idx;
        });
        filesRead.length.should.equal(uniqueFilesRead.length);

        fs.readFile = origReadFile;
        done();
      }

      function nestedThrow() {
        throw new Error('error');
      }

      try {
        nestedThrow();
      } catch (e) {
        raven.utils.parseStack(e, parseCallback);
      }
    });
  });

  describe('#getCulprit()', function() {
    it('should handle empty', function() {
      raven.utils.getCulprit({}).should.eql('<unknown>');
    });

    it('should handle missing module', function() {
      raven.utils
        .getCulprit({
          function: 'foo'
        })
        .should.eql('? at foo');
    });

    it('should handle missing function', function() {
      raven.utils
        .getCulprit({
          module: 'foo'
        })
        .should.eql('foo at ?');
    });

    it('should work', function() {
      raven.utils
        .getCulprit({
          module: 'foo',
          function: 'bar'
        })
        .should.eql('foo at bar');
    });
  });

  describe('#getModule()', function() {
    it('should identify a node_module', function() {
      var filename = '/home/x/node_modules/foo/bar/baz.js';
      raven.utils.getModule(filename).should.eql('foo.bar:baz');
    });

    it('should identify a main module', function() {
      var filename = '/home/x/foo/bar/baz.js';
      raven.utils.getModule(filename, '/home/x/').should.eql('foo.bar:baz');
    });

    it('should fallback to just filename', function() {
      var filename = '/home/lol.js';
      raven.utils.getModule(filename).should.eql('lol');
    });
  });

  describe.only('#serializeException()', function() {
    it('return [object Object] when reached depth=0', function() {
      var actual = raven.utils.serializeException(
        {
          a: 42,
          b: 'asd',
          c: true
        },
        0
      );
      var expected = stringify('[object Object]');

      actual.should.eql(expected);
    });

    it('should serialize one level deep with depth=1', function() {
      var actual = raven.utils.serializeException(
        {
          a: 42,
          b: 'asd',
          c: true,
          d: undefined,
          e:
            'very long string that is definitely over 120 characters, which is default for now but can be changed anytime because why not?',
          f: {foo: 42},
          g: [1, 'a', true],
          h: function() {}
        },
        1
      );
      var expected = stringify({
        a: 42,
        b: 'asd',
        c: true,
        d: undefined,
        e: 'very long string that is definitely over\u2026',
        f: '[object Object]',
        g: '[object Array]',
        h: '[object Function]'
      });

      actual.should.eql(expected);
    });

    it('should serialize arbitrary number of depths', function() {
      var actual = raven.utils.serializeException(
        {
          a: 42,
          b: 'asd',
          c: true,
          d: undefined,
          e:
            'very long string that is definitely over 40 characters, which is default for now but can be changed',
          f: {
            foo: 42,
            bar: {
              foo: 42,
              bar: {
                bar: {
                  bar: {
                    bar: 42
                  }
                }
              },
              baz: ['hello']
            },
            baz: [1, 'a', true]
          },
          g: [1, 'a', true],
          h: function() {}
        },
        5
      );
      var expected = stringify({
        a: 42,
        b: 'asd',
        c: true,
        d: undefined,
        e: 'very long string that is definitely over\u2026',
        f: {
          foo: 42,
          bar: {
            foo: 42,
            bar: {
              bar: {
                bar: '[object Object]'
              }
            },
            baz: ['hello']
          },
          baz: [1, 'a', true]
        },
        g: [1, 'a', true],
        h: '[object Function]'
      });

      actual.should.eql(expected);
    });

    it('should reduce depth if payload size was exceeded', function() {
      var actual = raven.utils.serializeException(
        {
          a: {
            a: '50kB worth of payload pickle rick',
            b: '50kB worth of payload pickle rick'
          },
          b: '50kB worth of payload pickle rick'
        },
        2,
        100
      );
      var expected = stringify({
        a: '[object Object]',
        b: '50kB worth of payload pickle rick'
      });

      actual.should.eql(expected);
    });

    it('should reduce depth only one level at the time', function() {
      var actual = raven.utils.serializeException(
        {
          a: {
            a: {
              a: {
                a: [
                  '50kB worth of payload pickle rick',
                  '50kB worth of payload pickle rick',
                  '50kB worth of payload pickle rick'
                ]
              }
            },
            b: '50kB worth of payload pickle rick'
          },
          b: '50kB worth of payload pickle rick'
        },
        4,
        200
      );
      var expected = stringify({
        a: {
          a: {
            a: {
              a: '[object Array]'
            }
          },
          b: '50kB worth of payload pickle rick'
        },
        b: '50kB worth of payload pickle rick'
      });

      actual.should.eql(expected);
    });

    it('should fallback to [object Object] if cannot reduce payload size enough', function() {
      var actual = raven.utils.serializeException(
        {
          a: '50kB worth of payload pickle rick',
          b: '50kB worth of payload pickle rick',
          c: '50kB worth of payload pickle rick',
          d: '50kB worth of payload pickle rick'
        },
        1,
        100
      );
      var expected = stringify('[object Object]');

      actual.should.eql(expected);
    });
  });
});
