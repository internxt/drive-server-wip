import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, ArrayMaxSize, IsArray } from 'class-validator';

export class CheckFoldersExistenceDto {
  @ApiProperty({
    description: 'Plain name of folder or array of plain names',
    example: ['My folder'],
  })
  @IsArray()
  @ArrayMaxSize(200, {
    message: 'Names parameter cannot contain more than 200 names',
  })
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return [value];
    }
    return value;
  })
  plainNames: string[];
}
