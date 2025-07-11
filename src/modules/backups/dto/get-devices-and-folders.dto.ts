import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { DevicePlatform } from '../device.domain';

export class GetDevicesAndFoldersDto {
  @ApiProperty()
  @IsEnum(DevicePlatform)
  @IsOptional()
  platform?: DevicePlatform;

  @ApiProperty()
  @IsString()
  @IsOptional()
  key?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  hostname?: string;

  @ApiProperty({ default: 50 })
  @IsNumber()
  @IsOptional()
  limit: number = 50;

  @ApiProperty({ default: 0 })
  @IsNumber()
  @IsOptional()
  offset: number = 0;
}
