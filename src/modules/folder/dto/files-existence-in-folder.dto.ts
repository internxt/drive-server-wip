import { Transform } from 'class-transformer';
import { IsString, ArrayMaxSize, IsArray, IsOptional } from 'class-validator';
import { FileAttributes } from '../../file/file.domain';
import { ApiProperty } from '@nestjs/swagger';

export class CheckFileExistenceInFolderDto {
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
  @IsArray()
  @ArrayMaxSize(50, {
    message: 'Names parameter cannot contain more than 50 names',
  })
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return [value];
    }
    return value;
  })
  plainName: FileAttributes['plainName'][];
}
