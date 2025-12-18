import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateFileDto } from './create-file.dto';

describe('CreateFileDto Validation', () => {
  const validData = {
    bucket: 'my-bucket',
    fileId: 'file123',
    encryptVersion: '03-aes',
    folderUuid: '550e8400-e29b-41d4-a716-446655440000',
    size: 100,
    plainName: 'test-file.txt',
  };

  it('When all required fields valid with size > 0 and fileId, then pass', async () => {
    const dto = plainToInstance(CreateFileDto, validData);

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When all required fields valid with size = 0 and no fileId, then pass', async () => {
    const data = {
      ...validData,
      size: 0,
      fileId: undefined,
    };
    const dto = plainToInstance(CreateFileDto, data);

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When optional fields omitted, then pass', async () => {
    const data = {
      bucket: 'my-bucket',
      fileId: 'file123',
      encryptVersion: '03-aes',
      folderUuid: '550e8400-e29b-41d4-a716-446655440000',
      size: 100,
      plainName: 'test-file.txt',
      // type, date, modificationTime, creationTime omitted
    };
    const dto = plainToInstance(CreateFileDto, data);

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When size > 0 and no fileId, then fail', async () => {
    const data = {
      ...validData,
      fileId: undefined,
    };
    const dto = plainToInstance(CreateFileDto, data);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const fileIdError = errors.find((e) => e.property === 'fileId');
    expect(fileIdError).toBeDefined();
    expect(fileIdError?.constraints).toHaveProperty('validateFileIdWithSize');
  });

  it('When size = 0 and fileId provided, then fail', async () => {
    const metadata = {
      bucket: 'my-bucket',
      fileId: 'file123',
      encryptVersion: '03-aes',
      folderUuid: '550e8400-e29b-41d4-a716-446655440000',
      size: 0,
      plainName: 'test-file.txt',
    };

    const dto = plainToInstance(CreateFileDto, metadata);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('When fileId exceeds 24 characters with size > 0, then fail', async () => {
    const data = {
      ...validData,
      fileId: 'a'.repeat(25), // 25 characters
    };
    const dto = plainToInstance(CreateFileDto, data);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const fileIdError = errors.find((e) => e.property === 'fileId');
    expect(fileIdError).toBeDefined();
    expect(fileIdError?.constraints).toHaveProperty('validateFileIdWithSize');
    expect(fileIdError?.constraints?.validateFileIdWithSize).toBe(
      'fileId must not exceed 24 characters',
    );
  });

  it('When bucket is missing, then fail', async () => {
    const data = {
      ...validData,
      bucket: undefined,
    };
    const dto = plainToInstance(CreateFileDto, data);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const bucketError = errors.find((e) => e.property === 'bucket');
    expect(bucketError).toBeDefined();
  });

  it('When folderUuid is not valid UUID, then fail', async () => {
    const data = {
      ...validData,
      folderUuid: 'not-a-uuid',
    };
    const dto = plainToInstance(CreateFileDto, data);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const folderUuidError = errors.find((e) => e.property === 'folderUuid');
    expect(folderUuidError).toBeDefined();
    expect(folderUuidError?.constraints).toHaveProperty('isUuid');
  });

  it('When size is negative, then fail', async () => {
    const data = {
      ...validData,
      size: -1,
    };
    const dto = plainToInstance(CreateFileDto, data);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const sizeError = errors.find((e) => e.property === 'size');
    expect(sizeError).toBeDefined();
    expect(sizeError?.constraints).toHaveProperty('min');
  });

  it('When plainName is missing, then fail', async () => {
    const data = {
      ...validData,
      plainName: undefined,
    };
    const dto = plainToInstance(CreateFileDto, data);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const plainNameError = errors.find((e) => e.property === 'plainName');
    expect(plainNameError).toBeDefined();
  });

  it('When encryptVersion is missing, then fail', async () => {
    const data = {
      ...validData,
      encryptVersion: undefined,
    };
    const dto = plainToInstance(CreateFileDto, data);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    const encryptVersionError = errors.find(
      (e) => e.property === 'encryptVersion',
    );
    expect(encryptVersionError).toBeDefined();
  });
});
