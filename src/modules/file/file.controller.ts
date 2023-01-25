import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { User } from '../user/user.domain';
import { FileUseCases } from './file.usecase';

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
}
