import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CheckFileExistenceInFolderDto } from './files-existence-in-folder.dto';

describe('CheckFileExistenceInFolderDto', () => {
  it('When valid data is passed, then no errors should be returned', async () => {
    const dto = plainToInstance(CheckFileExistenceInFolderDto, {
      files: [
        { plainName: 'file1', type: 'txt' },
        { plainName: 'file2', type: 'pdf' },
      ],
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When a single object is passed in files array, then it should validate successfully', async () => {
    const dto = plainToInstance(CheckFileExistenceInFolderDto, {
      files: [{ plainName: 'file1', type: 'txt' }],
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.files).toEqual([{ plainName: 'file1', type: 'txt' }]);
  });

  it('When files array exceeds max size, then it should fail', async () => {
    const files = Array.from({ length: 1991 }, (_, i) => ({
      plainName: `file${i + 1}`,
      type: 'txt',
    }));
    const dto = plainToInstance(CheckFileExistenceInFolderDto, { files });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toBeDefined();
  });

  it('When files contain non-string plainName values, then it should fail', async () => {
    const dto = plainToInstance(CheckFileExistenceInFolderDto, {
      files: [{ plainName: 123, type: 'txt' }],
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When files array is not provided, then it should fail', async () => {
    const dto = plainToInstance(CheckFileExistenceInFolderDto, {});

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When files is empty, then it should fail', async () => {
    const dto = plainToInstance(CheckFileExistenceInFolderDto, {
      files: null,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When type is not provided, then it should validate successfully', async () => {
    const dto = plainToInstance(CheckFileExistenceInFolderDto, {
      files: [{ plainName: 'file1' }],
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
