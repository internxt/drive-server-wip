import { validate } from 'class-validator';
import { BasicPaginationDto } from './basic-pagination.dto';

describe('BasicPaginationDto Validation', () => {
  it('When valid limit and offset are passed, then pass', async () => {
    const dto = new BasicPaginationDto();
    dto.limit = 10;
    dto.offset = 5;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When limit exceeds maximum value, then fail', async () => {
    const dto = new BasicPaginationDto();
    dto.limit = 60;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('max');
  });

  it('When limit is below minimum value, then fail', async () => {
    const dto = new BasicPaginationDto();
    dto.limit = -1;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('min');
  });

  it('When offset is below minimum value, then fail', async () => {
    const dto = new BasicPaginationDto();
    dto.offset = -5;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('min');
  });

  it('When offset is valid and limit is optional, then pass', async () => {
    const dto = new BasicPaginationDto();
    dto.offset = 0;
    dto.limit = undefined;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When no limit and offset are provided, then pass', async () => {
    const dto = new BasicPaginationDto();

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When limit is not a number, then fail', async () => {
    const dto = new BasicPaginationDto();
    dto.limit = 'not-a-number' as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isNumber');
  });

  it('When offset is not a number, then fail', async () => {
    const dto = new BasicPaginationDto();
    dto.offset = 'not-a-number' as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isNumber');
  });
});
