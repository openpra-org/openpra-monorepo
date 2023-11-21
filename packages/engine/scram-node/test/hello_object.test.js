const test = require("tape");

test("success: prints expected string", (t) => {
  const module = require("../lib/binding/module");
  const H = new module.HelloObject("carol");
  const check = H.helloMethod();
  t.equal(check, "carol", "returned expected string");
  t.end();
});

test("error: throws when passing empty string", (t) => {
  const module = require("../lib/binding/module");
  try {
    new module.HelloObject("");
  } catch (err) {
    t.ok(err, "expected error");
    t.equal(
      err.message,
      "arg must be a non-empty string",
      "expected error message",
    );
    t.end();
  }
});

test('error: throws when missing "new"', (t) => {
  const module = require("../lib/binding/module");
  try {
    module.HelloObject();
  } catch (err) {
    t.ok(err);
    t.equal(
      err.message,
      "Class constructors cannot be invoked without 'new'",
      "expected error message",
    );
    t.end();
  }
});

test("error: handles non-string arg within constructor", (t) => {
  const module = require("../lib/binding/module");
  try {
    new module.HelloObject(24);
  } catch (err) {
    t.ok(err, "expected error");
    t.ok(err.message, "A string was expected", "expected error message");
    t.end();
  }
});

test("error: handles missing arg", (t) => {
  const module = require("../lib/binding/module");
  try {
    new module.HelloObject();
  } catch (err) {
    t.ok(err, "expected error");
    t.ok(err.message, "must provide string arg", "expected error message");
    t.end();
  }
});
