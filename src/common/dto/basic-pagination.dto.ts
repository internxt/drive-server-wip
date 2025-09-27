import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export function createPaginationDto(maxLimit: number) {
  class PaginationDto {
    @ApiProperty({
      description: 'Items per page',
      example: Math.min(50, maxLimit),
      required: false,
      minimum: 0,
      maximum: maxLimit,
    })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    @Min(0)
    @Max(maxLimit)
    limit?: number;

    @ApiProperty({
      description: 'Offset for pagination',
      example: 0,
      required: false,
      minimum: 0,
    })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    @Min(0)
    offset?: number;
  }
  return PaginationDto;
}

export class BasicPaginationDto extends createPaginationDto(50) {}
export class LargePaginationDto extends createPaginationDto(1000) {}
