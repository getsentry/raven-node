/*eslint no-shadow:0*/
'use strict';

var assert = require('assert');

var raven = require('../');
var dsn = 'https://public:private@app.getsentry.com/269';

describe('raven.Client', function() {
  var client;

  beforeEach(function() {
    client = new raven.Client(dsn);
  });

  it('should manage contexts', function() {
    client.runWithLocalContext(function() {
      var ctx = client.getLocalContext();
      assert(ctx !== null);
      ctx.client.should.eql(client);
    });

    var ctx = client.getLocalContext();
    assert(ctx === null);
  });
});
