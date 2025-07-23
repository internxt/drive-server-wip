import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DevicePlatform } from '../device.domain';

export class CreateDeviceAndFolderDto {
  @ApiProperty({
    description: 'OS Installation unique identifier',
    example: '81CBB42C-73A0-9660-6C7D-2FE94627F3A3',
    required: false,
  })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiProperty({
    description: 'Device hostname',
    example: 'DESKTOP-ABC123',
    required: false,
  })
  @IsOptional()
  @IsString()
  hostname?: string;

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
      'Name of the device and folder to be created, this should be a readable name',
    example: 'Johns mac',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}
