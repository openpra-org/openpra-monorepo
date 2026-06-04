import { BadRequestException, Injectable, PipeTransform, ArgumentMetadata } from "@nestjs/common";
import { z } from "zod";
export function createZodDto<T extends z.ZodTypeAny>(schema: T) {
  class ZodDtoBase {
    static readonly _schema = schema;
  }
  return ZodDtoBase as unknown as {
    new (): z.infer<T>;
    readonly _schema: T;
  };
}
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const metatype = metadata.metatype as
      | (typeof Object & {
          _schema?: z.ZodTypeAny;
        })
      | undefined;
    if (!metatype?._schema) return value;
    const result = metatype._schema.safeParse(value);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return result.data;
  }
}
