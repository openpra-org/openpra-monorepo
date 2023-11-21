const test = require("tape");

test("prints world", (t) => {
  const module = require("../lib/binding/module");
  const check = module.hello();
  t.equal(check, "hello world", "returned world");
  t.end();
});
