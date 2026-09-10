import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { FileStatus } from '../file.domain';
import { GetSyncDto } from '../../../common/dto/get-sync.dto';

export class GetFilesSyncDto extends GetSyncDto {
  @ApiProperty({
    description: 'File status filter',
    enum: FileStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(FileStatus)
  status?: FileStatus;
}
