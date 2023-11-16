var test = require('tape');
var module = require('../lib/binding/module');

test('prints world', function(t) {
  var check = module.hello();
  t.equal(check, 'hello world', 'returned world');
  t.end();
});

