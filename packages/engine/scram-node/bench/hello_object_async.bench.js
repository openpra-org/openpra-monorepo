"use strict";

const argv = require("minimist")(process.argv.slice(2));
if (!argv.iterations || !argv.concurrency) {
  console.error("Please provide desired iterations, concurrency");
  console.error(
    "Example: \n\tnode bench/hello_object_async.bench.js --iterations 50 --concurrency 10",
  );
  console.error("Optional args: \n\t--mem (reports memory stats)");
  process.exit(1);
}

// This env var sets the libuv threadpool size.
// This value is locked in once a function interacts with the threadpool
// Therefore we need to set this value either in the shell or at the very
// top of a JS file (like we do here)
process.env.UV_THREADPOOL_SIZE = argv.concurrency;

const bytes = require("bytes");
const d3_queue = require("d3-queue");
const queue = d3_queue.queue();
const module = require("../lib/binding/module");

const H = new module.HelloObjectAsync("park bench");
const track_mem = !!argv.mem;
let runs = 0;
const memstats = {
  max_rss: 0,
  max_heap: 0,
  max_heap_total: 0,
};

function run(cb) {
  H.helloAsync({ louder: false }, (err) => {
    if (err) {
      return cb(err);
    }
    ++runs;
    if (track_mem && runs % 1000) {
      const mem = process.memoryUsage();
      if (mem.rss > memstats.max_rss) memstats.max_rss = mem.rss;
      if (mem.heapTotal > memstats.max_heap_total)
        memstats.max_heap_total = mem.heapTotal;
      if (mem.heapUsed > memstats.max_heap) memstats.max_heap = mem.heapUsed;
    }
    return cb();
  });
}

// Start monitoring time before async work begins within the defer iterator below.
// AsyncWorkers will kick off actual work before the defer iterator is finished,
// and we want to make sure we capture the time of the work of that initial cycle.
let time = +new Date();

for (let i = 0; i < argv.iterations; i++) {
  queue.defer(run);
}

queue.awaitAll((error) => {
  if (error) throw error;
  if (runs !== argv.iterations) {
    throw new Error("Error: did not run as expected");
  }
  // check rate
  time = +new Date() - time;

  if (time === 0) {
    console.log(
      "Warning: ms timer not high enough resolution to reliably track rate. Try more iterations",
    );
  } else {
    // number of milliseconds per iteration
    const rate = runs / (time / 1000);
    console.log(
      "Benchmark speed: " +
        rate.toFixed(0) +
        " runs/s (runs:" +
        runs +
        " ms:" +
        time +
        " )",
    );

    if (track_mem) {
      console.log(
        "Benchmark peak mem (max_rss, max_heap, max_heap_total): ",
        bytes(memstats.max_rss),
        bytes(memstats.max_heap),
        bytes(memstats.max_heap_total),
      );
    } else {
      console.log("Note: pass --mem to track memory usage");
    }
  }

  console.log(
    "Benchmark iterations:",
    argv.iterations,
    "concurrency:",
    argv.concurrency,
  );

  // There may be instances when you want to assert some performance metric
  //assert.equal(rate > 1000, true, 'speed not at least 1000/second ( rate was ' + rate + ' runs/s )');
});
