import { Module } from '@nestjs/common';
import { BrandingAssetPrimitivesService } from './branding-asset-primitives.service';

@Module({
  providers: [BrandingAssetPrimitivesService],
  exports: [BrandingAssetPrimitivesService],
})
export class BrandingAssetPrimitivesModule {}
