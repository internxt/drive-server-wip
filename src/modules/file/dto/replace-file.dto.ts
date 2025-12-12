import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReplaceFileDto {
  @ApiProperty({
    example: '651300a2da9b27001f63f384',
    description: 'File id (required when size > 0)',
    required: false,
  })
  @ValidateIf((o) => o.size > 0)
  @IsNotEmpty({ message: 'fileId is required when size is greater than 0' })
  @IsString()
  // Max varchar length in the database is 24
  @MaxLength(24)
  fileId?: string;

  @ApiProperty({
    example: '3005',
    description: 'New file size',
  })
  @IsPositive()
  @IsNumber()
  size: bigint;

  @IsDateString()
  @IsOptional()
  @ApiProperty({
    description: 'The last modification time of the file (optional)',
    required: false,
    example: '2023-05-30T12:34:56.789Z',
  })
  modificationTime?: Date;
}
