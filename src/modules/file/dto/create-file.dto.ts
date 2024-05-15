import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateFileDto {
  @IsString()
  name: string;

  @IsString()
  bucket: string;

  @IsString()
  fileId: string;

  @IsString()
  encryptVersion: string;

  @IsUUID('4')
  folderUuid: string;

  @IsNumber()
  size: bigint;

  @IsString()
  plainName: string;

  @IsString()
  @IsOptional()
  type: string;

  @IsDateString()
  @IsOptional()
  modificationTime: Date;

  @IsDateString()
  @IsOptional()
  date: Date;
}
