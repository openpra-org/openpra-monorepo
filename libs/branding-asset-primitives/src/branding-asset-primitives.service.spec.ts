import { Test, TestingModule } from '@nestjs/testing';
import { BrandingAssetPrimitivesService } from './branding-asset-primitives.service';

describe('BrandingAssetPrimitivesService', () => {
  let service: BrandingAssetPrimitivesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BrandingAssetPrimitivesService],
    }).compile();

    service = module.get<BrandingAssetPrimitivesService>(BrandingAssetPrimitivesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
