// import { z } from "nestjs-zod/z";
//
// const RolesValidatorSchema = z.object({
//   id: z.string().min(1).max(255),
//   name: z.string().min(1).max(255),
//   permissions: z.object({
//     action: z.string().min(1).max(255),
//     subject: z.string().min(1).max(255),
//     fields: z.optional(z.any()),
//     conditionals: z.optional(z.any()),
//     inverted: z.optional(z.boolean()),
//     reason: z.optional(z.string().min(1).max(255)),
//   }),
// });
//
// export { RolesValidatorSchema };
