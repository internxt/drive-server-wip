import { validate } from 'class-validator';
import { GetFavoriteFoldersDto } from './get-favorite-folders.dto';
import { SortOrder } from '../../../common/order.type';

describe('GetFavoriteFoldersDto', () => {
  it('When valid data with required fields is passed, then no errors should be returned', async () => {
    const dto = new GetFavoriteFoldersDto();
    dto.limit = 10;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When valid data with all optional fields is passed, then no errors should be returned', async () => {
    const dto = new GetFavoriteFoldersDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.updatedAt = '2024-01-01T00:00:00.000Z';
    dto.sort = 'plainName';
    dto.order = SortOrder.DESC;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When updatedAt is not a valid date string, then it should fail', async () => {
    const dto = new GetFavoriteFoldersDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.updatedAt = 'invalid-date';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When updatedAt is omitted, then it should pass', async () => {
    const dto = new GetFavoriteFoldersDto();
    dto.limit = 10;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When sort is provided together with a valid order, then it should pass', async () => {
    const dto = new GetFavoriteFoldersDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.sort = 'uuid';
    dto.order = SortOrder.ASC;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When sort is invalid and order is provided, then it should fail', async () => {
    const dto = new GetFavoriteFoldersDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.sort = 'invalidField' as any;
    dto.order = SortOrder.ASC;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When sort is invalid but order is not provided, then it should pass (validation is skipped)', async () => {
    const dto = new GetFavoriteFoldersDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.sort = 'invalidField' as any;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When order is valid and sort is provided, then it should pass', async () => {
    const dto = new GetFavoriteFoldersDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.sort = 'uuid';
    dto.order = SortOrder.ASC;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When order is invalid and sort is provided, then it should fail', async () => {
    const dto = new GetFavoriteFoldersDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.sort = 'uuid';
    dto.order = 'INVALID' as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When order is invalid but sort is not provided, then it should pass (validation is skipped)', async () => {
    const dto = new GetFavoriteFoldersDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.order = 'INVALID' as any;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
