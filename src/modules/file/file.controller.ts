import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { User } from '../user/user.domain';
import { FileUseCases } from './file.usecase';
import { BadRequestParamOutOfRangeException } from '../../lib/http/errors';
import { isNumber } from '../../lib/validators';
import API_LIMITS from '../../lib/http/limits';

const filesStatuses = ['ALL', 'EXISTS', 'TRASHED', 'DELETED'] as const;

@ApiTags('File')
@Controller('files')
export class FileController {
  constructor(private readonly fileUseCases: FileUseCases) {}

  @Get('/count')
  async getFileCount(
    @UserDecorator() user: User,
    @Query('status') status?: 'orphan' | 'trashed',
  ) {
    let count: number;

    if (status) {
      if (status === 'orphan') {
        count = await this.fileUseCases.getOrphanFilesCount(user.id);
      } else if (status === 'trashed') {
        count = await this.fileUseCases.getTrashFilesCount(user.id);
      } else {
        throw new BadRequestException();
      }
    } else {
      count = await this.fileUseCases.getDriveFilesCount(user.id);
    }

    return { count };
  }

  @Get('/')
  async getFiles(
    @UserDecorator() user: User,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Query('status') status: typeof filesStatuses[number],
    @Query('updatedAt') updatedAt?: string,
  ) {
    if (!isNumber(limit) || !isNumber(offset)) {
      throw new BadRequestException('Limit or offset are not numbers');
    }

    if (
      limit < API_LIMITS.FILES.GET.LIMIT.LOWER_BOUND ||
      limit > API_LIMITS.FILES.GET.LIMIT.UPPER_BOUND
    ) {
      throw new BadRequestParamOutOfRangeException(
        'limit',
        API_LIMITS.FILES.GET.LIMIT.LOWER_BOUND,
        API_LIMITS.FILES.GET.LIMIT.UPPER_BOUND,
      );
    }

    if (
      offset < API_LIMITS.FILES.GET.OFFSET.LOWER_BOUND ||
      offset > API_LIMITS.FILES.GET.OFFSET.UPPER_BOUND
    ) {
      throw new BadRequestParamOutOfRangeException(
        'offset',
        API_LIMITS.FILES.GET.OFFSET.LOWER_BOUND,
        API_LIMITS.FILES.GET.OFFSET.UPPER_BOUND,
      );
    }

    const knownStatus = filesStatuses.includes(status);

    if (!knownStatus) {
      throw new BadRequestException(`Unknown status "${status.toString()}"`);
    }

    const fns = {
      ALL: this.fileUseCases.getAllFilesUpdatedAfter,
      EXISTS: this.fileUseCases.getNotTrashedFilesUpdatedAfter,
      TRASHED: this.fileUseCases.getTrashedFilesUpdatedAfter,
      DELETED: this.fileUseCases.getRemovedFilesUpdatedAfter,
    };

    return fns[status].bind(this.fileUseCases)(
      user.id,
      new Date(updatedAt || 1),
      { limit, offset },
    );
  }
}
