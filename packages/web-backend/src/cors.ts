import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/* Custom configurations for CORS */
export const CorsConfig: Partial<CorsOptions> = {
  origin: process.env.corsorigin
};