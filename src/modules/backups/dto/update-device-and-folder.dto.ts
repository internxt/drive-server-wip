import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateDeviceAndFolderDto {
  @ApiProperty()
  @IsString()
  name: string;
}
