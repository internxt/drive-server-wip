import { validate } from 'class-validator';
import { GetFilesDto } from './get-files.dto';
import { FileStatus } from '../file.domain';
import { SortOrder } from '../../../common/order.type';
import { v4 } from 'uuid';

describe('GetFilesDto', () => {
  it('When valid data with required fields is passed, then no errors should be returned', async () => {
    const dto = new GetFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = FileStatus.EXISTS;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When valid data with all optional fields is passed, then no errors should be returned', async () => {
    const dto = new GetFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = FileStatus.EXISTS;
    dto.bucket = 'test-bucket-id';
    dto.sort = 'updatedAt';
    dto.order = SortOrder.DESC;
    dto.updatedAt = '2024-01-01T00:00:00.000Z';
    dto.lastId = v4();

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When status is missing, then it should fail', async () => {
    const dto = new GetFilesDto();
    dto.limit = 10;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When status is invalid, then it should fail', async () => {
    const dto = new GetFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = 'INVALID_STATUS' as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When bucket is a valid string, then it should pass', async () => {
    const dto = new GetFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = FileStatus.EXISTS;
    dto.bucket = 'valid-bucket-id';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When bucket is not a string, then it should fail', async () => {
    const dto = new GetFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = FileStatus.EXISTS;
    dto.bucket = 123 as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When sort is updatedAt, then it should pass', async () => {
    const dto = new GetFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = FileStatus.EXISTS;
    dto.sort = 'updatedAt';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When sort is plainName, then it should pass', async () => {
    const dto = new GetFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = FileStatus.EXISTS;
    dto.sort = 'plainName';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When sort is invalid, then it should fail', async () => {
    const dto = new GetFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = FileStatus.EXISTS;
    dto.sort = 'invalidField' as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When sort is omitted, then it should pass', async () => {
    const dto = new GetFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = FileStatus.EXISTS;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When order is valid, then it should pass', async () => {
    const dto = new GetFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = FileStatus.EXISTS;
    dto.order = SortOrder.ASC;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When order is invalid, then it should fail', async () => {
    const dto = new GetFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = FileStatus.EXISTS;
    dto.order = 'INVALID' as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When order is omitted, then it should pass', async () => {
    const dto = new GetFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = FileStatus.EXISTS;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When updatedAt is a valid string, then it should pass', async () => {
    const dto = new GetFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = FileStatus.EXISTS;
    dto.updatedAt = '2024-01-01T00:00:00.000Z';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When updatedAt is not a string, then it should fail', async () => {
    const dto = new GetFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = FileStatus.EXISTS;
    dto.updatedAt = 12345 as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When limit is 0, then it should fail', async () => {
    const dto = new GetFilesDto();
    dto.limit = 0;
    dto.offset = 0;
    dto.status = FileStatus.EXISTS;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When limit exceeds maximum, then it should fail', async () => {
    const dto = new GetFilesDto();
    dto.limit = 1001;
    dto.offset = 0;
    dto.status = FileStatus.EXISTS;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When limit is in valid range, then it should pass', async () => {
    const dto = new GetFilesDto();
    dto.limit = 50;
    dto.offset = 0;
    dto.status = FileStatus.EXISTS;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When offset is positive, then it should pass', async () => {
    const dto = new GetFilesDto();
    dto.limit = 10;
    dto.offset = 100;
    dto.status = FileStatus.EXISTS;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When offset is negative, then it should fail', async () => {
    const dto = new GetFilesDto();
    dto.limit = 10;
    dto.offset = -1;
    dto.status = FileStatus.EXISTS;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When lastId is valid, then it should pass', async () => {
    const dto = new GetFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = FileStatus.EXISTS;
    dto.lastId = v4();

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When lastId is invalid, then it should fail', async () => {
    const dto = new GetFilesDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = FileStatus.EXISTS;
    dto.lastId = 'INVALID';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
