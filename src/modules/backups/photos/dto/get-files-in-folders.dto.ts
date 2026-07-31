import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class GetFilesInFoldersDto {
  @ApiProperty({
    description: 'Folder uuids to fetch children files from',
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(200, {
    message: 'folderUuids cannot contain more than 200 uuids',
  })
  @IsUUID('4', { each: true })
  folderUuids: string[];

  @ApiProperty({
    description: 'Filter files updated after this date',
    required: false,
  })
  @IsOptional()
  @IsString()
  updatedAt?: string;

  @ApiProperty({
    description: 'Cursor token to fetch the next page of results',
    required: false,
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
