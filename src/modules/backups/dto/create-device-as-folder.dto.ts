import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateDeviceAsFolderDto {
  @ApiProperty()
  @IsString()
  deviceName: string;
}
