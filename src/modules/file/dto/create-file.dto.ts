import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateFileDto {
  @IsString()
  name: string;

  @IsString()
  bucket: string;

  @IsString()
  fileId: string;

  @IsString()
  encrypt_version: string;

  @IsNumber()
  folder_id: number;

  @IsNumber()
  size: bigint;

  @IsString()
  @IsOptional()
  plain_name: string;

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
