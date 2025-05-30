import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, ArrayMaxSize, IsArray } from 'class-validator';

export class CheckFoldersExistenceOldDto {
  @ApiProperty({
    description: 'Plain name of folder or array of plain names',
    example: ['My folder'],
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
  plainName: string[];
}
