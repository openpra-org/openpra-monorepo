import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export const CorsConfig: Partial<CorsOptions> = {
  origin: process.env.corsorigin,
};
