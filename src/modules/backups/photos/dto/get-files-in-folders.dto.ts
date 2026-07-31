import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class GetFilesInFoldersDto {
  @ApiProperty({
    description: 'Folder uuids to fetch children files from',
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(31, {
    message: 'folderUuids cannot contain more than 31 uuids',
  })
  @IsUUID(null, { each: true })
  folderUuids: string[];

  @ApiProperty({
    description:
      'Filter files updated after this date. Required if cursor is not provided',
    required: false,
  })
  @ValidateIf((dto) => !dto.cursor)
  @IsISO8601(
    { strict: true },
    { message: 'updatedAt must be a valid ISO8601 date' },
  )
  updatedAt?: string;

  @ApiProperty({
    description: 'Cursor token to fetch the next page of results',
    required: false,
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiProperty({
    description: 'Page size, max 1000',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
