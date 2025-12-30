import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ReplaceFileDto } from './replace-file.dto';

describe('ReplaceFileDto Validation', () => {
  const validData = {
    fileId: 'file123',
    size: 100,
  };

  it('When size > 0 and fileId provided, then pass', async () => {
    const dto = plainToInstance(ReplaceFileDto, validData);

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When size = 0 and no fileId, then pass', async () => {
    const data = {
      size: 0,
    };
    const dto = plainToInstance(ReplaceFileDto, data);

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When modificationTime is valid date string, then pass', async () => {
    const data = {
      ...validData,
      modificationTime: '2023-05-30T12:34:56.789Z',
    };
    const dto = plainToInstance(ReplaceFileDto, data);

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When modificationTime omitted, then pass', async () => {
    const data = {
      ...validData,
      // modificationTime omitted
    };
    const dto = plainToInstance(ReplaceFileDto, data);

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When size > 0 and no fileId, then fail', async () => {
    const data = {
      size: 100,
    };
    const dto = plainToInstance(ReplaceFileDto, data);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const fileIdError = errors.find((e) => e.property === 'fileId');
    expect(fileIdError).toBeDefined();
    expect(fileIdError?.constraints).toHaveProperty('validateFileIdWithSize');
  });

  it('When size = 0 and fileId provided, then fail', async () => {
    const data = {
      size: 0,
      fileId: 'file123',
    };
    const dto = plainToInstance(ReplaceFileDto, data);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const fileIdError = errors.find((e) => e.property === 'fileId');
    expect(fileIdError).toBeDefined();
    expect(fileIdError?.constraints).toHaveProperty('validateFileIdWithSize');
  });

  it('When fileId exceeds 24 characters with size > 0, then fail', async () => {
    const data = {
      size: 100,
      fileId: 'a'.repeat(25), // 25 characters
    };
    const dto = plainToInstance(ReplaceFileDto, data);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const fileIdError = errors.find((e) => e.property === 'fileId');
    expect(fileIdError).toBeDefined();
    expect(fileIdError?.constraints).toHaveProperty('validateFileIdWithSize');
    expect(fileIdError?.constraints?.validateFileIdWithSize).toBe(
      'fileId must not exceed 24 characters',
    );
  });

  it('When size is missing, then fail', async () => {
    const data = {
      fileId: 'file123',
    };
    const dto = plainToInstance(ReplaceFileDto, data);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const sizeError = errors.find((e) => e.property === 'size');
    expect(sizeError).toBeDefined();
  });

  it('When size is negative, then fail', async () => {
    const data = {
      fileId: 'file123',
      size: -1,
    };
    const dto = plainToInstance(ReplaceFileDto, data);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const sizeError = errors.find((e) => e.property === 'size');
    expect(sizeError).toBeDefined();
    expect(sizeError?.constraints).toHaveProperty('min');
  });

  it('When modificationTime is invalid date string, then fail', async () => {
    const data = {
      ...validData,
      modificationTime: 'not-a-date',
    };
    const dto = plainToInstance(ReplaceFileDto, data);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const modificationTimeError = errors.find(
      (e) => e.property === 'modificationTime',
    );
    expect(modificationTimeError).toBeDefined();
    expect(modificationTimeError?.constraints).toHaveProperty('isDateString');
  });
});
