import { ApiProperty } from '@nestjs/swagger';
import { FolderDto } from '../../../folder/dto/responses/folder.dto';

export class DeviceDto extends FolderDto {
  @ApiProperty()
  hasBackups: boolean;

  @ApiProperty()
  lastBackupAt: Date;
}
