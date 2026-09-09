import { IsISO8601, IsUUID, IsIn, IsOptional } from 'class-validator';
import { FileStatus } from '../file.domain';

export class FileUpdatedAtIdCursorDto {
  @IsISO8601()
  updatedAt: string;

  @IsUUID()
  uuid: string;
}

export class FileSyncCursorDto extends FileUpdatedAtIdCursorDto {
  @IsOptional()
  @IsIn(Object.values(FileStatus))
  status?: FileStatus;
}
