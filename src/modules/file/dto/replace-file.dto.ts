import { IsDateString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ValidateFileIdWithSize } from '../../../common/validators/file-id-size.validator';

export class ReplaceFileDto {
  @ApiProperty({
    example: '651300a2da9b27001f63f384',
    description:
      'File id (required when size > 0, must not be provided when size = 0)',
    required: false,
  })
  @ValidateFileIdWithSize()
  fileId?: string;

  @ApiProperty({
    example: '3005',
    description: 'New file size',
  })
  @Min(0)
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
