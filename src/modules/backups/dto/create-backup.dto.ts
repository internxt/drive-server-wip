import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsDate,
} from 'class-validator';

export class CreateBackupDto {
  @IsNumber()
  deviceId: number;

  @IsString()
  path: string;

  @IsNumber()
  interval: number;

  @IsBoolean()
  enabled: boolean;

  @IsString()
  encrypt_version: string;
}
