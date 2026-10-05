import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { FolderStatus } from '../folder.domain';
import { GetSyncDto } from '../../../common/dto/get-sync.dto';

export class GetFoldersSyncDto extends GetSyncDto {
  @ApiProperty({
    description: 'Folder status filter',
    enum: FolderStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(FolderStatus)
  status?: FolderStatus;
}
