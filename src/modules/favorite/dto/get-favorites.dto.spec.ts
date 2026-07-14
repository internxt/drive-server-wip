import { validate } from 'class-validator';
import { GetFavoritesDto } from './get-favorites.dto';
import { FavoriteItemType } from '../favorite.domain';
import { SortOrder } from '../../../common/order.type';

describe('GetFavoritesDto', () => {
  const newDto = () => {
    const dto = new GetFavoritesDto();
    dto.type = FavoriteItemType.File;
    dto.limit = 10;
    dto.offset = 0;
    return dto;
  };

  it('When valid data with required fields is passed, then no errors should be returned', async () => {
    const dto = newDto();

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When valid data with all optional fields is passed, then no errors should be returned', async () => {
    const dto = newDto();
    dto.type = FavoriteItemType.Folder;
    dto.sort = 'plainName';
    dto.order = SortOrder.DESC;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When type is missing, then it should fail', async () => {
    const dto = newDto();
    dto.type = undefined as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When type is invalid, then it should fail', async () => {
    const dto = newDto();
    dto.type = 'documents' as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When sort is provided together with a valid order, then it should pass', async () => {
    const dto = newDto();
    dto.sort = 'uuid';
    dto.order = SortOrder.ASC;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When sort is invalid and order is provided, then it should fail', async () => {
    const dto = newDto();
    dto.sort = 'invalidField' as any;
    dto.order = SortOrder.ASC;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When sort is invalid but order is not provided, then it should pass (validation is skipped)', async () => {
    const dto = newDto();
    dto.sort = 'invalidField' as any;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When order is invalid and sort is provided, then it should fail', async () => {
    const dto = newDto();
    dto.sort = 'uuid';
    dto.order = 'INVALID' as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When order is invalid but sort is not provided, then it should pass (validation is skipped)', async () => {
    const dto = newDto();
    dto.order = 'INVALID' as any;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When limit is 0, then it should fail', async () => {
    const dto = newDto();
    dto.limit = 0;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When offset is negative, then it should fail', async () => {
    const dto = newDto();
    dto.offset = -1;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
