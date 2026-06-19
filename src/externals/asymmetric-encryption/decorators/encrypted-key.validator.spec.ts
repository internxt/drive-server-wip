import { validate } from 'class-validator';
import { IsEncryptedKeyOfSize } from './encrypted-key.validator';

const AES_GCM_HEADER_BYTES = 64 + 16 + 16;

class GenericTestDto {
  @IsEncryptedKeyOfSize()
  privateKey: string;
}

class ExactSizeTestDto {
  @IsEncryptedKeyOfSize(2176)
  privateKey: string;
}

class RangeSizeTestDto {
  @IsEncryptedKeyOfSize({ minPayloadBytes: 712, maxPayloadBytes: 716 })
  privateKey: string;
}

describe('IsEncryptedKeyOfSize', () => {
  describe('without exactPayloadBytes', () => {
    it('When decoded blob is larger than the AES-GCM header, then pass', async () => {
      const dto = new GenericTestDto();
      dto.privateKey = Buffer.alloc(AES_GCM_HEADER_BYTES + 1, 1).toString(
        'base64',
      );

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('When decoded blob is exactly the AES-GCM header size, then fail', async () => {
      const dto = new GenericTestDto();
      dto.privateKey = Buffer.alloc(AES_GCM_HEADER_BYTES, 1).toString('base64');

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('privateKey');
      expect(errors[0].constraints).toHaveProperty('isEncryptedKeyOfSize');
    });

    it('When value is not base64, then fail', async () => {
      const dto = new GenericTestDto();
      dto.privateKey = 'not-valid-base64!!!';

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isEncryptedKeyOfSize');
    });

    it('When value is empty string, then fail', async () => {
      const dto = new GenericTestDto();
      dto.privateKey = '';

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isEncryptedKeyOfSize');
    });

    it('When value is undefined, then fail', async () => {
      const dto = new GenericTestDto();
      dto.privateKey = undefined;

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isEncryptedKeyOfSize');
    });
  });

  describe('with exactPayloadBytes', () => {
    it('When decoded blob is exactly header + payload bytes, then pass', async () => {
      const dto = new ExactSizeTestDto();
      dto.privateKey = Buffer.alloc(AES_GCM_HEADER_BYTES + 2176, 1).toString(
        'base64',
      );

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('When decoded blob is smaller than expected, then fail', async () => {
      const dto = new ExactSizeTestDto();
      dto.privateKey = Buffer.alloc(AES_GCM_HEADER_BYTES + 2175, 1).toString(
        'base64',
      );

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isEncryptedKeyOfSize');
    });

    it('When decoded blob is larger than expected, then fail', async () => {
      const dto = new ExactSizeTestDto();
      dto.privateKey = Buffer.alloc(AES_GCM_HEADER_BYTES + 2177, 1).toString(
        'base64',
      );

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isEncryptedKeyOfSize');
    });
  });

  describe('with min/max payload bytes range', () => {
    it('When payload is at the lower bound, then pass', async () => {
      const dto = new RangeSizeTestDto();
      dto.privateKey = Buffer.alloc(AES_GCM_HEADER_BYTES + 712, 1).toString(
        'base64',
      );

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('When payload is at the upper bound, then pass', async () => {
      const dto = new RangeSizeTestDto();
      dto.privateKey = Buffer.alloc(AES_GCM_HEADER_BYTES + 716, 1).toString(
        'base64',
      );

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('When payload is below the lower bound, then fail', async () => {
      const dto = new RangeSizeTestDto();
      dto.privateKey = Buffer.alloc(AES_GCM_HEADER_BYTES + 711, 1).toString(
        'base64',
      );

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isEncryptedKeyOfSize');
    });

    it('When payload is above the upper bound, then fail', async () => {
      const dto = new RangeSizeTestDto();
      dto.privateKey = Buffer.alloc(AES_GCM_HEADER_BYTES + 717, 1).toString(
        'base64',
      );

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isEncryptedKeyOfSize');
    });
  });
});
