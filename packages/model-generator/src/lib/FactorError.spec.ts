/**
 * @file FactorError.test.ts
 * @brief This file contains unit tests for the FactorError class.
 * @details The FactorError class extends the built-in Error class and is used to throw and catch errors that occur
 * when setting and calculating factors in the Factors class.
 */

import FactorError from "./FactorError";

describe("FactorError", () => {
  test("should create an error with a message", () => {
    const error = new FactorError("Test error message");
    expect(error.message).toBe("Test error message");
    expect(error.name).toBe("FactorError");
  });

  test("should create an error without a message", () => {
    const error = new FactorError();
    expect(error.message).toBe("");
    expect(error.name).toBe("FactorError");
  });
});
