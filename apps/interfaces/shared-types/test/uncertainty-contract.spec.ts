import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { UncertainParameterTableSchema } from "interfaces-mef-types/zod/core/uncertainty";

const fixtureRoot = join(__dirname, "..", "..", "mef-types", "core", "fixtures", "uncertainty");

const fixtures = (folder: string): [string, string][] =>
  readdirSync(join(fixtureRoot, folder))
    .sort()
    .map((file) => [file, readFileSync(join(fixtureRoot, folder, file), "utf8")]);

describe("uncertainty contract fixtures", () => {
  it.each(fixtures("valid"))("accepts %s", (_name, text) => {
    expect(UncertainParameterTableSchema.safeParse(JSON.parse(text)).success).toBe(true);
  });

  it.each(fixtures("invalid-shape"))("rejects %s", (_name, text) => {
    expect(UncertainParameterTableSchema.safeParse(JSON.parse(text)).success).toBe(false);
  });

  it.each(fixtures("invalid-meaning"))("leaves the meaning of %s to PRAXIS", (_name, text) => {
    expect(UncertainParameterTableSchema.safeParse(JSON.parse(text)).success).toBe(true);
  });
});
