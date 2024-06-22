test("should return 2", () => {
  const runWorker = require("../../build/Release/scram-node.node");

  function AsyncWorkerCompletion(err: unknown, result: unknown) {
    if (err) {
      console.log("SimpleAsyncWorker returned an error: ", err);
    } else {
      console.log("SimpleAsyncWorker returned '" + result + "'.");
    }
  }

  let result = runWorker.runSimpleAsyncWorker(2, AsyncWorkerCompletion);
  expect(result).toBe("SimpleAsyncWorker for 2 seconds queued.");
});
