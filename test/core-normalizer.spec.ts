import { NormalizerService } from '../src/core/normalizer/normalizer.service';

describe('NormalizerService', () => {
  it('should be defined', () => {
    const service = new NormalizerService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    expect(service).toBeDefined();
  });
});
