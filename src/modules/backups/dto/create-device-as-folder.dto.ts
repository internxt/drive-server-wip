import { IsString } from 'class-validator';

export class CreateDeviceAsFolderDto {
  @IsString()
  deviceName: string;
}
