import { EMPTY_TOKEN } from "./AuthToken";

describe("AuthToken", () => {
  it("provides a default role when empty", () => {
    expect(EMPTY_TOKEN.roles).toEqual(["member"]);
  });
});
