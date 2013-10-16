var raven = require('..');
var should = require('should');

describe('raven.dsn', function() {
  describe('#parseDSN()', function(){
    it('should parse hosted Sentry DSN without path', function(){
      var dsn = raven.Client.parseDSN('https://8769c40cf49c4cc58b51fa45d8e2d166:296768aa91084e17b5ac02d3ad5bc7e7@app.getsentry.com/269');
      var expected = {
        protocol: 'https',
        public_key: '8769c40cf49c4cc58b51fa45d8e2d166',
        private_key: '296768aa91084e17b5ac02d3ad5bc7e7',
        host: 'app.getsentry.com',
        path: '/',
        project_id: 269,
        port: 0
      };
      dsn.should.eql(expected);
    });

    it('should parse http not on hosted Sentry with path', function(){
      var dsn = raven.Client.parseDSN('http://8769c40cf49c4cc58b51fa45d8e2d166:296768aa91084e17b5ac02d3ad5bc7e7@mysentry.com/some/other/path/269');
      var expected = {
        protocol: 'http',
        public_key: '8769c40cf49c4cc58b51fa45d8e2d166',
        private_key: '296768aa91084e17b5ac02d3ad5bc7e7',
        host: 'mysentry.com',
        path: '/some/other/path/',
        project_id: 269,
        port: 0
      };
      dsn.should.eql(expected);
    });

    it('should parse DSN with non-standard port', function(){
      var dsn = raven.Client.parseDSN('https://8769c40cf49c4cc58b51fa45d8e2d166:296768aa91084e17b5ac02d3ad5bc7e7@mysentry.com:8443/some/other/path/269');
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
      raven.Client.parseDSN(false).should.eql(false);
      raven.Client.parseDSN('').should.eql(false);
    });

    it('should parse UDP DSN', function(){
      var dsn = raven.Client.parseDSN('udp://8769c40cf49c4cc58b51fa45d8e2d166:296768aa91084e17b5ac02d3ad5bc7e7@mysentry.com:1234/some/other/path/269');
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

    it('should ignore a sub-transport protocol', function(){
      var dsn = raven.Client.parseDSN('gevent+https://8769c40cf49c4cc58b51fa45d8e2d166:296768aa91084e17b5ac02d3ad5bc7e7@mysentry.com:8443/some/other/path/269');
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
});
