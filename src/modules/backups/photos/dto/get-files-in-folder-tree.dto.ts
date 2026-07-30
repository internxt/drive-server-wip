import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetFilesInFolderTreeDto {
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
