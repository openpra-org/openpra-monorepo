import { z } from "zod";

const OAuthProviderSchema = z.enum(["google", "github", "orcid"]);

type OAuthProvider = z.infer<typeof OAuthProviderSchema>;

const ConnectedAccountSchema = z.object({
  provider: OAuthProviderSchema,
  displayName: z.string(),
});

type ConnectedAccount = z.infer<typeof ConnectedAccountSchema>;

export { OAuthProviderSchema, ConnectedAccountSchema };
export type { OAuthProvider, ConnectedAccount };
