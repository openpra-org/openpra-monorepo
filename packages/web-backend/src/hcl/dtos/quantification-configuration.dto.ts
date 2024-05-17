import { z } from "nestjs-zod/z";
import { createZodDto } from "nestjs-zod";

const hclModelQuantificationConfigurationSchema = z.object({
  configuration: z.object({
    constructor: z.object({
      tree_id: z.number(),
      replace_transfer_gates_with_basic_events: z.boolean().optional(),
    }),
    engine: z.object({
      BBNSolver: z.number(),
      OrderingRule: z.number(),
      BDDConstructor: z.number(),
    }),
    quantify: z.object({
      type: z.string(),
      mission_test_interval: z.number().or(z.null()),
      user_defined_max_cutset: z.number(),
      targets: z.string(),
      sampling: z
        .object({
          method: z.string().optional(),
          number_of_samples: z.number().optional(),
          confidence_interval: z.number().optional(),
        })
        .default({}),
      importance: z
        .object({
          events: z.string().optional(),
          measures: z.array(z.string()).optional(),
        })
        .default({}),
    }),
  }),
});

export class HclModelQuantificationConfigurationDto extends createZodDto(hclModelQuantificationConfigurationSchema) {}
