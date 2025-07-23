import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { DevicePlatform } from '../device.domain';
import { Transform } from 'class-transformer';

export class GetDevicesAndFoldersDto {
  @ApiProperty({
    description: 'Device platform',
    example: DevicePlatform.LINUX,
    enum: DevicePlatform,
    enumName: 'DevicePlatform',
    required: false,
  })
  @IsEnum(DevicePlatform)
  @IsOptional()
  platform?: DevicePlatform;

  @ApiProperty({
    description: 'OS Installation unique identifier',
    example: '81CBB42C-73A0-9660-6C7D-2FE94627F3A3',
    required: false,
  })
  @IsString()
  @IsOptional()
  key?: string;

  @ApiProperty({
    description: 'Device hostname',
    example: 'DESKTOP-ABC123',
    required: false,
  })
  @IsString()
  @IsOptional()
  hostname?: string;

  @ApiProperty({ default: 50 })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  limit: number = 50;

  @ApiProperty({ default: 0 })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  offset: number = 0;
}
