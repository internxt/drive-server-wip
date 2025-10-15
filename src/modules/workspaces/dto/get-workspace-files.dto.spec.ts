import { validate } from 'class-validator';
import { GetWorkspaceFilesQueryDto } from './get-workspace-files.dto';
import { FileStatus } from '../../file/file.domain';
import { SortOrder } from '../../../common/order.type';
import { v4 } from 'uuid';

describe('GetWorkspaceFilesQueryDto', () => {
  it('When valid data with all fields is passed, then no errors should be returned', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 100;
    dto.offset = 0;
    dto.status = FileStatus.EXISTS;
    dto.bucket = v4();
    dto.sort = 'updatedAt';
    dto.order = SortOrder.DESC;
    dto.updatedAt = '2024-01-01T00:00:00.000Z';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When valid data with only pagination fields is passed, then no errors should be returned', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 100;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When status is EXISTS, then it should pass', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 100;
    dto.offset = 0;
    dto.status = FileStatus.EXISTS;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When status is ALL, then it should pass', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 100;
    dto.offset = 0;
    dto.status = 'ALL';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When status is invalid, then it should fail', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 100;
    dto.offset = 0;
    dto.status = 'INVALID_STATUS' as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When bucket is a valid string, then it should pass', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 100;
    dto.offset = 0;
    dto.bucket = 'valid-bucket-id';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When bucket is not a string, then it should fail', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 100;
    dto.offset = 0;
    dto.bucket = 123 as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When bucket is omitted, then it should pass', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 100;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When sort is updatedAt, then it should pass', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 100;
    dto.offset = 0;
    dto.sort = 'updatedAt';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When sort is plainName, then it should pass', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 100;
    dto.offset = 0;
    dto.sort = 'plainName';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When sort is omitted, then it should pass', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 100;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When order is valid, then it should pass', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 100;
    dto.offset = 0;
    dto.order = SortOrder.DESC;

    const errorsDesc = await validate(dto);
    expect(errorsDesc.length).toBe(0);
  });

  it('When order is invalid, then it should fail', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 100;
    dto.offset = 0;
    dto.order = 'INVALID' as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When order is omitted, then it should pass', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 100;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When updatedAt is a valid date string, then it should pass', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 100;
    dto.offset = 0;
    dto.updatedAt = '2024-01-01T00:00:00.000Z';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When updatedAt is an invalid date string, then it should fail', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 100;
    dto.offset = 0;
    dto.updatedAt = 'invalid-date';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When updatedAt is not a string, then it should fail', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 100;
    dto.offset = 0;
    dto.updatedAt = 12345 as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When updatedAt is omitted, then it should pass', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 100;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When limit is 0, then it should pass', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 0;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When limit is negative, then it should fail', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = -1;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When limit exceeds maximum, then it should fail', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 1001;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When limit is at minimum valid value, then it should pass', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 0;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When limit is at maximum valid value, then it should pass', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 1000;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When limit is in valid range, then it should pass', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 500;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When offset is negative, then it should fail', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 100;
    dto.offset = -1;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When offset is at minimum valid value, then it should pass', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 100;
    dto.offset = 0;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When offset is positive, then it should pass', async () => {
    const dto = new GetWorkspaceFilesQueryDto();
    dto.limit = 100;
    dto.offset = 100;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
