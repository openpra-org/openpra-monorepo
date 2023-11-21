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
