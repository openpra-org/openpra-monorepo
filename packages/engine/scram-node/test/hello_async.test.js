const test = require("tape");

test("success: prints loud busy world", (t) => {
  const module = require("../lib/binding/module");
  module.helloAsync({ louder: true }, (err, result) => {
    if (err) throw err;
    t.equal(result, "...threads are busy async bees...hello world!!!!");
    t.end();
  });
});

test("success: prints regular busy world", (t) => {
  const module = require("../lib/binding/module");
  module.helloAsync({ louder: false }, (err, result) => {
    if (err) throw err;
    t.equal(result, "...threads are busy async bees...hello world");
    t.end();
  });
});

test("success: buffer regular busy world", (t) => {
  const module = require("../lib/binding/module");
  module.helloAsync({ buffer: true }, (err, result) => {
    if (err) throw err;
    t.equal(result.length, 44);
    t.equal(typeof result, "object");
    t.equal(result.toString(), "...threads are busy async bees...hello world");
    t.end();
  });
});

test("error: handles invalid louder value", (t) => {
  const module = require("../lib/binding/module");
  module.helloAsync({ louder: "oops" }, (err) => {
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
  module.helloAsync({ buffer: "oops" }, (err) => {
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
  module.helloAsync("oops", (err) => {
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
  try {
    module.helloAsync({ louder: "oops" }, {});
  } catch (err) {
    t.ok(err, "expected error");
    t.ok(
      err.message.indexOf("second arg 'callback' must be a function") > -1,
      "expected error message",
    );
    t.end();
  }
});
