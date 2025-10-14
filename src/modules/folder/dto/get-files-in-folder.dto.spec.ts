import { validate } from 'class-validator';
import { GetFilesInFoldersDto } from './get-files-in-folder.dto';
import { SortOrder } from '../../../common/order.type';

describe('GetFilesInFoldersDto', () => {
  it('When valid data is passed, then no errors should be returned', async () => {
    const dto = new GetFilesInFoldersDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.sort = 'updatedAt';
    dto.order = SortOrder.ASC;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When sort and order are omitted, then it should pass', async () => {
    const dto = new GetFilesInFoldersDto();
    dto.limit = 10;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When invalid sort value is passed, then it should fail', async () => {
    const dto = new GetFilesInFoldersDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.sort = 'invalidField' as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isEnum');
  });

  it('When invalid order value is passed, then it should fail', async () => {
    const dto = new GetFilesInFoldersDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.order = 'INVALID' as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isEnum');
  });

  it('When limit is 0, then it should fail', async () => {
    const dto = new GetFilesInFoldersDto();
    dto.limit = 0;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('min');
  });

  it('When limit is negative, then it should fail', async () => {
    const dto = new GetFilesInFoldersDto();
    dto.limit = -1;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('min');
  });

  it('When limit exceeds maximum, then it should fail', async () => {
    const dto = new GetFilesInFoldersDto();
    dto.limit = 51;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('max');
  });

  it('When limit is in valid range, then it should pass', async () => {
    const dto = new GetFilesInFoldersDto();
    dto.limit = 50;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When offset is negative, then it should fail', async () => {
    const dto = new GetFilesInFoldersDto();
    dto.limit = 10;
    dto.offset = -1;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('min');
  });
});
