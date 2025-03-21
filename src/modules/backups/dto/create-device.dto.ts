import { IsString } from 'class-validator';

export class CreateDeviceDto {
  @IsString()
  deviceName: string;

  @IsString()
  platform: string;
}
