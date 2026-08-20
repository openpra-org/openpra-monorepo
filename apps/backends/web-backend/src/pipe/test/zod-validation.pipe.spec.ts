import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "../zod-validation.pipe";

describe("ZodValidationPipe", () => {
  const schema = z.object({
    name: z.string().min(1, "Name required"),
    age: z.number().int().min(0),
  });

  it("returns parsed data when input matches the schema", () => {
    const pipe = new ZodValidationPipe(schema);
    const result = pipe.transform({ name: "Ada", age: 30 });
    expect(result).toEqual({ name: "Ada", age: 30 });
  });

  it("throws BadRequestException with formatted issues when input is invalid", () => {
    const pipe = new ZodValidationPipe(schema);
    try {
      pipe.transform({ name: "", age: -1 });
      fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const body = (err as BadRequestException).getResponse() as { message: string; issues: { path: string; message: string }[] };
      expect(body.message).toBe("Validation failed");
      expect(body.issues.length).toBeGreaterThanOrEqual(1);
      expect(body.issues.map((i) => i.path)).toEqual(expect.arrayContaining(["name"]));
    }
  });

  it("reports nested paths joined by dots", () => {
    const nested = z.object({ inner: z.object({ field: z.string().min(1) }) });
    const pipe = new ZodValidationPipe(nested);
    try {
      pipe.transform({ inner: { field: "" } });
      fail("should have thrown");
    } catch (err) {
      const body = (err as BadRequestException).getResponse() as { issues: { path: string }[] };
      expect(body.issues[0].path).toBe("inner.field");
    }
  });
});
