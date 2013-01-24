// builtin
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');

var interfaces = require('..').interfaces;

describe('raven.interfaces', function() {
  describe('#Message', function(){
    it('should parse some text without kwargs', function(){
      var parsed = interfaces.message('Howdy');
      parsed.message.should.equal('Howdy');
    });

    it('should parse some text with kwargs', function(){
      var parsed = interfaces.message('Howdy', {'foo': 'bar'});
      parsed.message.should.equal('Howdy');
    });
  });

  describe('#Http()', function(){
    it('should parse a request object', function(){
      var mockReq = {
        method: 'GET',
        url: '/some/path?key=value',
        headers: {
          host: 'mattrobenolt.com'
        },
        body: '',
        socket: {
          encrypted: true
        }
      };

      var parsed = interfaces.http(mockReq);
      parsed.url.should.equal('https://mattrobenolt.com/some/path?key=value');
    });
  });

  describe('#query()', function(){
    it('should parse a query', function(){
      var query = 'SELECT * FROM `something`';
      var engine = 'mysql';
      var parsed = interfaces.query(query, engine);
      parsed.query.should.equal('SELECT * FROM `something`');
      parsed.engine.should.equal('mysql');
    });
  });

  describe('#Exception()', function(){
    it('should parse plain Error object', function(){
      var parsed = interfaces.exception(new Error());
      parsed.type.should.equal('Error');
      parsed.value.should.equal('');
    });

    it('should parse Error with message', function(){
      var parsed = interfaces.exception(new Error('Crap'));
      parsed.type.should.equal('Error');
      parsed.value.should.equal('Crap');
    });

    it('should parse TypeError with message', function(){
      var parsed = interfaces.exception(new TypeError('Crap'));
      parsed.type.should.equal('TypeError');
      parsed.value.should.equal('Crap');
    });

    it('should parse caught real error', function(){
      try {
        var o = {};
        o['...']['Derp']();
      } catch(e) {
        var parsed = interfaces.exception(e);
        parsed.type.should.equal('TypeError');
        parsed.value.should.equal('Cannot call method \'Derp\' of undefined');
      }
    });
  });

  describe('#stacktrace()', function(){
    var src = fs.readFileSync(__dirname + '/fixtures/stack.js', 'utf8');

    // capture error from running the invalid file
    var error;
    try {
      vm.runInThisContext(src, './test/fixtures/stack.js');
    } catch (e) {
      error = e;
    }

    it('should not throw an error', function(done){
      interfaces.stacktrace.parseStack(error, done);
    });

    it('should parse the correct number of frames', function(done){
      interfaces.stacktrace.parseStack(error, function(err, frames) {
        // subtract one for message line
        var lines = error.stack.split('\n').length - 1;

        // parsed frames should be the number of errors in the stack string
        frames.length.should.equal(lines);
        done();
      });
    });

    it('should parse all frames correctly', function(done){
      interfaces.stacktrace.parseStack(error, function(err, frames) {
        assert.ifError(err);

        var idx = frames.length;

        frames[--idx].should.eql({
          function: 'trace',
          filename: './test/fixtures/stack.js',
          lineno: 11,
          typename: 'Object',
          pre_context: ['', 'function bar(a,b,c) {', '  var test=\'yay!\';', '  trace();', '}', '', 'function trace() {'],
          context_line: '  console.log(__stack[1].fun.arguments);',
          post_context: ['}', '', 'foo();', '']
        });

        frames[--idx].should.eql({
          function: 'bar',
          filename: './test/fixtures/stack.js',
          lineno: 7,
          typename: 'Object',
          pre_context: ['function foo() {', '  bar(\'hey\');', '}', '', 'function bar(a,b,c) {', '  var test=\'yay!\';'],
          context_line: '  trace();',
          post_context: ['}', '', 'function trace() {', '  console.log(__stack[1].fun.arguments);', '}', '', 'foo();']
        });

        frames[--idx].should.eql({
          function: 'foo',
          filename: './test/fixtures/stack.js',
          lineno: 2,
          typename: 'Object',
          pre_context: ['function foo() {'],
          context_line: '  bar(\'hey\');',
          post_context: ['}', '', 'function bar(a,b,c) {', '  var test=\'yay!\';', '  trace();', '}', '']
        });

        frames[--idx].should.eql({
          function: null,
          filename: './test/fixtures/stack.js',
          lineno: 14,
          typename: null,
          pre_context: ['  trace();', '}', '', 'function trace() {', '  console.log(__stack[1].fun.arguments);', '}', ''],
          context_line: 'foo();',
          post_context: ['']
        });

        done();
      });
    });
  });
});
