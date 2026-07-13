import { validate } from 'class-validator';
import { GetFavoriteFilesDto } from './get-favorite-files.dto';
import { SortOrder } from '../../../common/order.type';

describe('GetFavoriteFilesDto', () => {
  it('When valid data with required fields is passed, then no errors should be returned', async () => {
    const dto = new GetFavoriteFilesDto();
    dto.limit = 10;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When valid data with all optional fields is passed, then no errors should be returned', async () => {
    const dto = new GetFavoriteFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.sort = 'updatedAt';
    dto.order = SortOrder.DESC;
    dto.updatedAt = '2024-01-01T00:00:00.000Z';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When sort is uuid, then it should pass', async () => {
    const dto = new GetFavoriteFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.sort = 'uuid';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When sort is invalid, then it should fail', async () => {
    const dto = new GetFavoriteFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.sort = 'invalidField' as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When sort is omitted, then it should pass', async () => {
    const dto = new GetFavoriteFilesDto();
    dto.limit = 10;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When order is valid, then it should pass', async () => {
    const dto = new GetFavoriteFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.order = SortOrder.ASC;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When order is invalid, then it should fail', async () => {
    const dto = new GetFavoriteFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.order = 'INVALID' as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When updatedAt is a valid string, then it should pass', async () => {
    const dto = new GetFavoriteFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.updatedAt = '2024-01-01T00:00:00.000Z';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When updatedAt is not a string, then it should fail', async () => {
    const dto = new GetFavoriteFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.updatedAt = 12345 as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When limit is 0, then it should fail', async () => {
    const dto = new GetFavoriteFilesDto();
    dto.limit = 0;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When limit exceeds maximum, then it should fail', async () => {
    const dto = new GetFavoriteFilesDto();
    dto.limit = 1001;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When offset is negative, then it should fail', async () => {
    const dto = new GetFavoriteFilesDto();
    dto.limit = 10;
    dto.offset = -1;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});