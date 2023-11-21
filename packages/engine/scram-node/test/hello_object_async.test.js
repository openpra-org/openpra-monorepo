const test = require("tape");

test("success: prints expected string via custom constructor", (t) => {
  const module = require("../lib/binding/module");
  const H = new module.HelloObjectAsync("carol");
  H.helloAsync({ louder: false }, (err, result) => {
    if (err) throw err;
    t.equal(result, "...threads are busy async bees...hello carol");
    t.end();
  });
});

test("success: prints loud busy world", (t) => {
  const module = require("../lib/binding/module");
  const H = new module.HelloObjectAsync("world");
  H.helloAsync({ louder: true }, (err, result) => {
    if (err) throw err;
    t.equal(result, "...threads are busy async bees...hello world!!!!");
    t.end();
  });
});

test("success: return buffer busy world", (t) => {
  const module = require("../lib/binding/module");
  const H = new module.HelloObjectAsync("world");
  H.helloAsync({ buffer: true }, (err, result) => {
    if (err) throw err;
    t.equal(result.length, 44);
    t.equal(typeof result, "object");
    t.equal(result.toString(), "...threads are busy async bees...hello world");
    t.end();
  });
});

test("error: throws when passing empty string", (t) => {
  const module = require("../lib/binding/module");
  try {
    new module.HelloObjectAsync("");
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
    module.HelloObjectAsync("world");
  } catch (err) {
    t.ok(err, "expected error");
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
    new module.HelloObjectAsync(24);
  } catch (err) {
    console.log(err.message);
    t.equal(err.message, "String expected", "expected error message");
    t.end();
  }
});

test("error: handles invalid louder value", (t) => {
  const module = require("../lib/binding/module");
  const H = new module.HelloObjectAsync("world");
  H.helloAsync({ louder: "oops" }, (err) => {
    t.ok(err, "expected error");
    t.ok(
      err.message.indexOf("option 'louder' must be a boolean") > -1,
      "expected error message",
    );
    t.end();
  });
});

test("error: handles invalid buffer value", (t) => {
  const module = require("../lib/binding/module");
  const H = new module.HelloObjectAsync("world");
  H.helloAsync({ buffer: "oops" }, (err) => {
    t.ok(err, "expected error");
    t.ok(
      err.message.indexOf("option 'buffer' must be a boolean") > -1,
      "expected error message",
    );
    t.end();
  });
});

test("error: handles invalid options value", (t) => {
  const module = require("../lib/binding/module");
  const H = new module.HelloObjectAsync("world");
  H.helloAsync("oops", (err) => {
    t.ok(err, "expected error");
    t.ok(
      err.message.indexOf("first arg 'options' must be an object") > -1,
      "expected error message",
    );
    t.end();
  });
});

test("error: handles missing callback", (t) => {
  const module = require("../lib/binding/module");
  const H = new module.HelloObjectAsync("world");
  try {
    H.helloAsync({ louder: false }, {});
  } catch (err) {
    t.ok(err, "expected error");
    t.ok(
      err.message.indexOf("second arg 'callback' must be a function") > -1,
      "expected error message",
    );
    t.end();
  }
});

test("error: handles missing arg", (t) => {
  const module = require("../lib/binding/module");
  try {
    new module.HelloObjectAsync();
  } catch (err) {
    t.ok(err, "expected error");
    t.equal(err.message, "String expected", "expected error message");
    t.end();
  }
});
