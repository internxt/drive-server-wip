import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { v4 } from 'uuid';
import { CreateThumbnailDto } from './create-thumbnail.dto';

describe('CreateThumbnailDto Validation', () => {
  const validData = {
    fileUuid: v4(),
    type: 'png',
    size: 1024,
    maxWidth: 300,
    maxHeight: 300,
    bucketId: 'bucketId',
    bucketFile: 'bucketFile',
    encryptVersion: '03-aes',
  };

  it('When all required fields are provided, then validation should pass', async () => {
    const dto = plainToInstance(CreateThumbnailDto, validData);

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When fileUuid is missing, then validation should fail', async () => {
    const { fileUuid: _fileUuid, ...data } = validData;
    const dto = plainToInstance(CreateThumbnailDto, { ...data, fileId: 123 });

    const errors = await validate(dto);

    expect(errors.map((e) => e.property)).toContain('fileUuid');
  });

  it('When fileUuid is not a valid UUID, then validation should fail', async () => {
    const dto = plainToInstance(CreateThumbnailDto, {
      ...validData,
      fileUuid: 'not-a-uuid',
    });

    const errors = await validate(dto);

    expect(errors.map((e) => e.property)).toContain('fileUuid');
  });
});
