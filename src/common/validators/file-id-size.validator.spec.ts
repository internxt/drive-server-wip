import { validate } from 'class-validator';
import { ValidateFileIdWithSize } from './file-id-size.validator';

class TestDto {
  @ValidateFileIdWithSize()
  fileId?: string;

  size: number | bigint;
}

describe('ValidateFileIdWithSize', () => {
  it('When size > 0 and fileId provided, then pass', async () => {
    const dto = new TestDto();
    dto.size = 100;
    dto.fileId = 'file123';

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When size = 0 and fileId not provided, then pass', async () => {
    const dto = new TestDto();
    dto.size = 0;

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When size = 0 and fileId is undefined, then pass', async () => {
    const dto = new TestDto();
    dto.size = 0;
    dto.fileId = undefined;

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When size > 0 and fileId not provided, then fail', async () => {
    const dto = new TestDto();
    dto.size = 100;

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('fileId');
    expect(errors[0].constraints).toHaveProperty('validateFileIdWithSize');
    expect(errors[0].constraints?.validateFileIdWithSize).toBe(
      'fileId is required when size is greater than 0',
    );
  });

  it('When size > 0 and fileId is empty string, then fail', async () => {
    const dto = new TestDto();
    dto.size = 100;
    dto.fileId = '';

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('fileId');
    expect(errors[0].constraints?.validateFileIdWithSize).toBe(
      'fileId is required when size is greater than 0',
    );
  });

  it('When size = 0 and fileId provided, then fail', async () => {
    const dto = new TestDto();
    dto.size = 0;
    dto.fileId = 'file123';

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('fileId');
    expect(errors[0].constraints?.validateFileIdWithSize).toBe(
      'fileId must not be provided when size is 0',
    );
  });

  it('When size is BigInt 0 and fileId not provided, then pass', async () => {
    const dto = new TestDto();
    dto.size = BigInt(0);

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When size is BigInt > 0 and fileId provided, then pass', async () => {
    const dto = new TestDto();
    dto.size = BigInt(100);
    dto.fileId = 'file123';

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When size is BigInt > 0 and fileId not provided, then fail', async () => {
    const dto = new TestDto();
    dto.size = BigInt(100);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints?.validateFileIdWithSize).toBe(
      'fileId is required when size is greater than 0',
    );
  });

  it('When fileId is exactly 24 characters, then pass', async () => {
    const dto = new TestDto();
    dto.size = 100;
    dto.fileId = '123456789012345678901234'; // 24 characters

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When fileId exceeds 24 characters, then fail', async () => {
    const dto = new TestDto();
    dto.size = 100;
    dto.fileId = '1234567890123456789012345'; // 25 characters

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('fileId');
    expect(errors[0].constraints?.validateFileIdWithSize).toBe(
      'fileId must not exceed 24 characters',
    );
  });

  it('When fileId is 30 characters, then fail', async () => {
    const dto = new TestDto();
    dto.size = 100;
    dto.fileId = '123456789012345678901234567890'; // 30 characters

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('fileId');
    expect(errors[0].constraints?.validateFileIdWithSize).toBe(
      'fileId must not exceed 24 characters',
    );
  });
});
