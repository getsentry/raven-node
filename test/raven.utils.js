var raven = require('../')
  , fs = require('fs')
  , glob = require('glob')
  , path = require('path')
  , should = require('should');

describe('raven.utils', function() {
  describe('#constructChecksum()', function(){
    it('should md5 hash the message', function(){
      var kwargs = {
        'foo': 'bar',
        'message': 'This is awesome!'
      };
      raven.utils.constructChecksum(kwargs).should.equal('caf30724990022cfec2532741d6b631e');
    });
  });

  describe('#parseDSN()', function(){
    it('should parse hosted Sentry DSN without path', function(){
      var dsn = raven.utils.parseDSN('https://8769c40cf49c4cc58b51fa45d8e2d166:296768aa91084e17b5ac02d3ad5bc7e7@app.getsentry.com/269');
      var expected = {
        protocol: 'https',
        public_key: '8769c40cf49c4cc58b51fa45d8e2d166',
        private_key: '296768aa91084e17b5ac02d3ad5bc7e7',
        host: 'app.getsentry.com',
        path: '/',
        project_id: 269,
        port: 443
      };
      dsn.should.eql(expected);
    });

    it('should parse http not on hosted Sentry with path', function(){
      var dsn = raven.utils.parseDSN('http://8769c40cf49c4cc58b51fa45d8e2d166:296768aa91084e17b5ac02d3ad5bc7e7@mysentry.com/some/other/path/269');
      var expected = {
        protocol: 'http',
        public_key: '8769c40cf49c4cc58b51fa45d8e2d166',
        private_key: '296768aa91084e17b5ac02d3ad5bc7e7',
        host: 'mysentry.com',
        path: '/some/other/path/',
        project_id: 269,
        port: 80
      };
      dsn.should.eql(expected);
    });

    it('should parse DSN with non-standard port', function(){
      var dsn = raven.utils.parseDSN('https://8769c40cf49c4cc58b51fa45d8e2d166:296768aa91084e17b5ac02d3ad5bc7e7@mysentry.com:8443/some/other/path/269');
      var expected = {
        protocol: 'https',
        public_key: '8769c40cf49c4cc58b51fa45d8e2d166',
        private_key: '296768aa91084e17b5ac02d3ad5bc7e7',
        host: 'mysentry.com',
        path: '/some/other/path/',
        project_id: 269,
        port: 8443
      };
      dsn.should.eql(expected);
    });

    it('should return false for a falsey dns', function(){
      raven.utils.parseDSN(false).should.eql(false);
      raven.utils.parseDSN('').should.eql(false);
    });

    it('should parse UDP DSN', function(){
      var dsn = raven.utils.parseDSN('udp://8769c40cf49c4cc58b51fa45d8e2d166:296768aa91084e17b5ac02d3ad5bc7e7@mysentry.com:1234/some/other/path/269');
      var expected = {
        protocol: 'udp',
        public_key: '8769c40cf49c4cc58b51fa45d8e2d166',
        private_key: '296768aa91084e17b5ac02d3ad5bc7e7',
        host: 'mysentry.com',
        path: '/some/other/path/',
        project_id: 269,
        port: 1234
      };
      dsn.should.eql(expected);
    });

    it('show throw an Error on invalid transport protocol', function(){
      (function(){
        raven.utils.parseDSN('noop://8769c40cf49c4cc58b51fa45d8e2d166:296768aa91084e17b5ac02d3ad5bc7e7@mysentry.com:1234/some/other/path/269');
      }).should.throw();
    });

    it('should ignore a sub-transport protocol', function(){
      var dsn = raven.utils.parseDSN('gevent+https://8769c40cf49c4cc58b51fa45d8e2d166:296768aa91084e17b5ac02d3ad5bc7e7@mysentry.com:8443/some/other/path/269');
      var expected = {
        protocol: 'https',
        public_key: '8769c40cf49c4cc58b51fa45d8e2d166',
        private_key: '296768aa91084e17b5ac02d3ad5bc7e7',
        host: 'mysentry.com',
        path: '/some/other/path/',
        project_id: 269,
        port: 8443
      };
      dsn.should.eql(expected);
    });
  });

  describe('#parseAuthHeader()', function(){
    it('should parse all parameters', function(){
      var timestamp = 12345,
        api_key = 'xyz',
        project_id = 1;
      var expected = 'Sentry sentry_version=2.0, sentry_timestamp=12345, sentry_client=raven-node/'+raven.version+', sentry_key=xyz, project_id=1';
      raven.utils.getAuthHeader(timestamp, api_key, project_id).should.equal(expected);
    });
  });

  describe('#parseStack()', function(){
    // needs new tests with a mock callsite object
    it('shouldnt barf on an invalid stack', function(){
      var parseStack = raven.utils.parseStack;
      var callback = function(frames) { frames.length.should.equal(0); }
      parseStack('lol', callback);
      parseStack(undefined, callback);
      parseStack([], callback);
      parseStack([{lol: 1}], callback);
    });
  });
});
