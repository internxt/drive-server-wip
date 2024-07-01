import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum DeviceType {
  macos = 'macos',
  android = 'android',
  ios = 'ios',
}

export class RegisterNotificationTokenDto {
  @IsNotEmpty()
  @ApiProperty({
    example: '0f8fad5b-d9cb-469f-a165-70867728950e',
    description: 'device token',
  })
  token: string;

  @IsNotEmpty()
  @ApiProperty({
    example: 'macos',
    description: 'device type',
  })
  @IsEnum(DeviceType)
  type: DeviceType;
}
