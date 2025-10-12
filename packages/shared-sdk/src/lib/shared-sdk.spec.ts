import { AdminRole, MemberRole, CollabRole } from "./shared-sdk";

describe("shared-sdk barrel", () => {
  it("exports predefined role ids", () => {
    expect(typeof AdminRole).toBe("string");
    expect(typeof MemberRole).toBe("string");
    expect(typeof CollabRole).toBe("string");
  });
});
