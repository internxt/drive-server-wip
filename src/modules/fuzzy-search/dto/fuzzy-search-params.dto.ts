import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export const MIN_SEARCH_LENGTH = 3;
export const MAX_SEARCH_LENGTH = 255;

export class FuzzySearchParamsDto {
  @ApiProperty({
    description: 'Part of the item name to search for',
    example: 'report',
    minLength: MIN_SEARCH_LENGTH,
    maxLength: MAX_SEARCH_LENGTH,
  })
  @IsString()
  @MinLength(MIN_SEARCH_LENGTH)
  @MaxLength(MAX_SEARCH_LENGTH)
  search: string;
}
