import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { DevicePlatform } from '../device.domain';

export class CreateDeviceAndAttachFolderDto {
  @ApiProperty({
    description: 'OS Installation unique identifier',
    example: '81CBB42C-73A0-9660-6C7D-2FE94627F3A3',
    required: false,
  })
  @IsString()
  key: string;

  @ApiProperty({
    description: 'Device hostname',
    example: 'DESKTOP-ABC123',
    required: false,
  })
  @IsString()
  hostname: string;

  @ApiProperty({
    description: 'Device platform',
    example: DevicePlatform.LINUX,
    enum: DevicePlatform,
    enumName: 'DevicePlatform',
  })
  @IsEnum(DevicePlatform)
  @IsNotEmpty()
  platform: DevicePlatform;

  @ApiProperty({
    description:
      'Name of the device to be created, this should be a readable name. Use the already existent folder name if you are attaching a folder',
    example: 'Johns mac',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Uuuid of the folder to attach to the device',
    example: '0c303e45-3f5f-4224-9886-9c5afdea0e7e',
  })
  @IsString()
  @IsNotEmpty()
  folderUuid: string;
}
