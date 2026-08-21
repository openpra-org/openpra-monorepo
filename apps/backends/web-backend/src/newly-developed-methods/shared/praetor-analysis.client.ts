import { BadGatewayException, Injectable } from "@nestjs/common";
import { z } from "zod";

const PraetorStructuredErrorSchema = z
  .object({
    kind: z.string().trim().min(1),
    code: z.string().trim().min(1),
    message: z.string().trim().min(1),
    details: z.record(z.string(), z.unknown()),
  })
  .strict();

const PraetorNativeResponseSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    result: z.unknown().optional(),
    error: PraetorStructuredErrorSchema.optional(),
  })
  .strict()
  .superRefine((response, context) => {
    if ((response.result === undefined) === (response.error === undefined)) {
      context.addIssue({
        code: "custom",
        path: [],
        message: "PRAXIS response must contain exactly one of result or error",
      });
    }
  });

type PraetorStructuredError = z.infer<typeof PraetorStructuredErrorSchema>;
type PraetorNativeResponse = z.infer<typeof PraetorNativeResponseSchema>;

@Injectable()
class PraetorAnalysisClient {
  async execute(request: unknown): Promise<PraetorNativeResponse> {
    const baseUrl = (process.env["PRAETOR_URL"] ?? "http://localhost:3000/q").replace(/\/$/, "");
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/praxis/native/execute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(300_000),
      });
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadGatewayException(`Unable to reach Praetor: ${message}`);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new BadGatewayException(
        `Praetor returned HTTP ${response.status}${body.length > 0 ? `: ${body}` : ""}`,
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadGatewayException(`Praetor returned invalid JSON: ${message}`);
    }

    const parsed = PraetorNativeResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadGatewayException("Praetor returned an invalid native solver response");
    }
    return parsed.data;
  }
}

export {
  PraetorAnalysisClient,
  PraetorNativeResponseSchema,
  PraetorStructuredErrorSchema,
};
export type { PraetorNativeResponse, PraetorStructuredError };
