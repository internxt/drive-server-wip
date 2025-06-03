import { Type } from 'class-transformer';
import {
  IsString,
  ArrayMaxSize,
  IsOptional,
  IsNotEmpty,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { FileAttributes } from '../../file/file.domain';
import { ApiProperty } from '@nestjs/swagger';

export class FilesNameAndType {
  @ApiProperty({
    description: 'Type of file',
    example: 'pdf',
    required: false,
  })
  @IsString()
  @IsOptional()
  type?: FileAttributes['type'];

  @ApiProperty({
    description: 'Plain name of file',
    example: 'example',
  })
  @IsString()
  plainName: FileAttributes['plainName'];
}

export class CheckFileExistenceInFolderDto {
  @IsNotEmpty()
  @ApiProperty({
    description: 'Array of files with names and types',
  })
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested()
  @Type(() => FilesNameAndType)
  files: FilesNameAndType[];
}
