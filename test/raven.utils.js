var raven = require('../');
var fs = require('fs');
var glob = require('glob');
var path = require('path');
var should = require('should');
var vm = require('vm');

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

  describe('#getSignature()', function(){
    it('should sign a key, timestamp, and message with md5 hash', function(){
      raven.utils.getSignature('abc', 'This is awesome!', 1331932297938).should.equal('76cfb41aa49f91e5eb4ffbb1fe0c5b578459c537');
    });
  });

  describe('#parseAuthHeader()', function(){
    it('should parse all parameters', function(){
      var signature = 'abc',
        timestamp = 12345,
        api_key = 'xyz',
        project_id = 1;
      var expected = 'Sentry sentry_version=2.0, sentry_signature=abc, sentry_timestamp=12345, sentry_client=raven-node/'+raven.version+', sentry_key=xyz, project_id=1';
      raven.utils.getAuthHeader(signature, timestamp, api_key, project_id).should.equal(expected);
    });
  });

  describe('#parseStack()', function(){
    var src = fs.readFileSync(__dirname + '/fixtures/stack.js', 'utf8');

    // capture error from running the invalid file
    var error;
    try {
      vm.runInThisContext(src, './test/fixtures/stack.js');
    } catch (e) {
      error = e;
    }

    it('should not throw an error', function(done){
      raven.utils.parseStack(error, done);
    });

    it('should parse the correct number of frames', function(done){
      raven.utils.parseStack(error, function(err, frames) {
        // subtract one for message line
        var lines = error.stack.split('\n').length - 1;

        // parsed frames should be the number of errors in the stack string
        frames.length.should.equal(lines);
        done();
      });
    });

    it('should parse all frames correctly', function(done){
      raven.utils.parseStack(error, function(err, frames) {
        frames[0].should.eql({
          function: 'trace',
          filename: './test/fixtures/stack.js',
          lineno: 11,
          typename: 'Object',
          pre_context: ['', 'function bar(a,b,c) {', '  var test=\'yay!\';', '  trace();', '}', '', 'function trace() {'],
          context_line: '  console.log(__stack[1].fun.arguments);',
          post_context: ['}', '', 'foo();', '']
        });

        frames[1].should.eql({
          function: 'bar',
          filename: './test/fixtures/stack.js',
          lineno: 7,
          typename: 'Object',
          pre_context: ['function foo() {', '  bar(\'hey\');', '}', '', 'function bar(a,b,c) {', '  var test=\'yay!\';'],
          context_line: '  trace();',
          post_context: ['}', '', 'function trace() {', '  console.log(__stack[1].fun.arguments);', '}', '', 'foo();']
        });

        frames[2].should.eql({
          function: 'foo',
          filename: './test/fixtures/stack.js',
          lineno: 2,
          typename: 'Object',
          pre_context: ['function foo() {'],
          context_line: '  bar(\'hey\');',
          post_context: ['}', '', 'function bar(a,b,c) {', '  var test=\'yay!\';', '  trace();', '}', '']
        });

        frames[3].should.eql({
          function: null,
          filename: './test/fixtures/stack.js',
          lineno: 14,
          typename: 'Object',
          pre_context: ['  trace();', '}', '', 'function trace() {', '  console.log(__stack[1].fun.arguments);', '}', ''],
          context_line: 'foo();',
          post_context: ['']
        });

        done();
      });
    });
  });
});
