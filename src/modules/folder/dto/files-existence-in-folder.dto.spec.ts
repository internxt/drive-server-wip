import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CheckFileExistenceInFolderDto } from './files-existence-in-folder.dto';

describe('CheckFileExistenceInFolderDto', () => {
  it('When valid data is passed, then no errors should be returned', async () => {
    const dto = plainToInstance(CheckFileExistenceInFolderDto, {
      plainName: ['file1', 'file2'],
      type: 'txt',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When a single string is passed for plainName, then it should be transformed into an array and validate successfully', async () => {
    const dto = plainToInstance(CheckFileExistenceInFolderDto, {
      plainName: 'file1',
      type: 'txt',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.plainName).toEqual(['file1']);
  });

  it('When plainName array exceeds max size, then it should fail', async () => {
    const plainName = Array.from({ length: 51 }, (_, i) => `file${i + 1}`);
    const dto = plainToInstance(CheckFileExistenceInFolderDto, {
      plainName,
      type: 'txt',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toBeDefined();
  });

  it('When plainName contains non-string values, then it should fail', async () => {
    const dto = plainToInstance(CheckFileExistenceInFolderDto, {
      plainName: [1, 2, 3],
      type: 'txt',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When plainName is not provided, then it should fail', async () => {
    const dto = plainToInstance(CheckFileExistenceInFolderDto, {
      type: 'txt',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When plainName is an empty array, then it should validate successfully', async () => {
    const dto = plainToInstance(CheckFileExistenceInFolderDto, {
      plainName: [],
      type: 'txt',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When type is not provided, then it should validate successfully', async () => {
    const dto = plainToInstance(CheckFileExistenceInFolderDto, {
      plainName: ['file1', 'file2'],
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
