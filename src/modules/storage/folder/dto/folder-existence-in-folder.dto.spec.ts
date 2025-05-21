import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CheckFoldersExistenceDto } from './folder-existence-in-folder.dto';

describe('CheckFoldersExistenceDto', () => {
  it('When valid data is passed, then no errors should be returned', async () => {
    const dto = plainToInstance(CheckFoldersExistenceDto, {
      plainNames: ['folder1', 'folder2'],
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When a single string is passed, then it should be transformed into an array and validate successfully', async () => {
    const dto = plainToInstance(CheckFoldersExistenceDto, {
      plainNames: 'folder1',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.plainNames).toEqual(['folder1']);
  });

  it('When plainName array exceeds max size, then it should fail', async () => {
    const plainNames = Array.from({ length: 201 }, (_, i) => `folder${i + 1}`);
    const dto = plainToInstance(CheckFoldersExistenceDto, { plainNames });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toBeDefined();
  });

  it('When plainName contains non-string values, then it should fail', async () => {
    const dto = plainToInstance(CheckFoldersExistenceDto, {
      plainNames: [1, 2, 3],
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When plainName is not provided, then it should fail', async () => {
    const dto = plainToInstance(CheckFoldersExistenceDto, {});

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When plainName is an empty array, then it should faild', async () => {
    const dto = plainToInstance(CheckFoldersExistenceDto, { plainNames: [] });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
