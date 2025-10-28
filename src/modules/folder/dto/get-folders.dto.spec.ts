import { validate } from 'class-validator';
import { GetFoldersQueryDto } from './get-folders.dto';
import { SortOrder } from '../../../common/order.type';
import { FolderStatus } from '../folder.domain';

describe('GetFoldersQueryDto', () => {
  it('When valid data with required fields is passed, then no errors should be returned', async () => {
    const dto = new GetFoldersQueryDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = FolderStatus.EXISTS;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When valid data with all optional fields is passed, then no errors should be returned', async () => {
    const dto = new GetFoldersQueryDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = 'ALL';
    dto.updatedAt = '2024-01-01T00:00:00.000Z';
    dto.sort = 'uuid';
    dto.order = SortOrder.DESC;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When status is invalid, then it should fail', async () => {
    const dto = new GetFoldersQueryDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = 'INVALID_STATUS' as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When updatedAt is not a valid date string, then it should fail', async () => {
    const dto = new GetFoldersQueryDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = FolderStatus.EXISTS;
    dto.updatedAt = 'invalid-date';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When sort is invalid, then it should fail', async () => {
    const dto = new GetFoldersQueryDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = FolderStatus.EXISTS;
    dto.sort = 'invalidField' as any;
    dto.order = SortOrder.ASC;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('When order is valid, then it should pass', async () => {
    const dto = new GetFoldersQueryDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = FolderStatus.EXISTS;
    dto.sort = 'uuid';
    dto.order = SortOrder.ASC;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('When order is invalid, then it should fail', async () => {
    const dto = new GetFoldersQueryDto();
    dto.limit = 10;
    dto.offset = 0;
    dto.status = FolderStatus.EXISTS;
    dto.sort = 'uuid';
    dto.order = 'INVALID' as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
