import { IsISO8601, IsUUID, IsIn, IsOptional } from 'class-validator';
import { FolderStatus } from '../folder.domain';

export class FolderUpdatedAtIdCursorDto {
  @IsISO8601()
  updatedAt: string;

  @IsUUID()
  uuid: string;
}

export class FolderSyncCursorDto extends FolderUpdatedAtIdCursorDto {
  @IsOptional()
  @IsIn(Object.values(FolderStatus))
  status?: FolderStatus;
}
