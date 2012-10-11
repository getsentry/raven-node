var fs = require('fs');
var vm = require('vm');

var runtime = require('../lib/runtime');

describe('raven.runtime', function() {
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
      runtime.parseStack(error, done);
    });

    it('should parse the correct number of frames', function(done){
      runtime.parseStack(error, function(err, frames) {
        // subtract one for message line
        var lines = error.stack.split('\n').length - 1;

        // parsed frames should be the number of errors in the stack string
        frames.length.should.equal(lines);
        done();
      });
    });

    it('should parse all frames correctly', function(done){
      runtime.parseStack(error, function(err, frames) {
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
