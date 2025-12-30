import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ValidateFileIdWithSize } from '../../../common/validators/file-id-size.validator';

export class CreateFileDto {
  @ApiProperty({
    description: 'The bucket where the file is stored',
    example: 'my-bucket',
  })
  @IsString()
  bucket: string;

  @ApiProperty({
    description:
      'The ID of the file (required when size > 0, must not be provided when size = 0)',
    example: 'file12345',
    required: false,
  })
  @ValidateFileIdWithSize()
  fileId?: string;

  @ApiProperty({
    description: 'The encryption version used for the file',
    example: '03-aes',
  })
  @IsString()
  encryptVersion: string;

  @ApiProperty({
    description: 'The UUID of the folder containing the file',
    type: 'string',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  folderUuid: string;

  @ApiProperty({
    description: 'The size of the file in bytes',
    type: 'number',
    format: 'bigint',
    example: 123456789,
  })
  @Min(0)
  @IsNumber()
  size: bigint;

  @ApiProperty({
    description: 'The plain text name of the file',
    example: 'example',
  })
  @IsString()
  plainName: string;

  @ApiProperty({
    description: 'The type of the file (optional)',
    required: false,
    example: 'text',
  })
  @IsString()
  @IsOptional()
  type: string;

  @ApiProperty({
    description: 'The last modification time of the file (optional)',
    required: false,
    example: '2023-05-30T12:34:56.789Z',
  })
  @IsDateString()
  @IsOptional()
  modificationTime: Date;

  @ApiProperty({
    description: 'The date associated with the file (optional)',
    required: false,
    example: '2023-05-30T12:34:56.789Z',
  })
  @IsDateString()
  @IsOptional()
  date?: Date;

  @ApiProperty({
    description: 'The creation time of the file (optional)',
    required: false,
    example: '2023-05-30T12:34:56.789Z',
  })
  @ApiProperty({
    description: 'The date associated with the file (optional)',
    required: false,
    example: '2023-05-30T12:34:56.789Z',
  })
  @IsDateString()
  @IsOptional()
  creationTime?: Date;
}
