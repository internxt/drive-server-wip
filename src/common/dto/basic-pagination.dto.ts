import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

function createPaginationDto(maxLimit: number) {
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

function createRequiredPaginationDto(maxLimit: number) {
  class RequiredPaginationDto {
    @ApiProperty({
      description: 'Items per page',
      example: Math.min(50, maxLimit),
      required: true,
      minimum: 1,
      maximum: maxLimit,
    })
    @IsNumber()
    @Type(() => Number)
    @Min(1)
    @Max(maxLimit)
    limit: number;

    @ApiProperty({
      description: 'Offset for pagination',
      example: 0,
      required: true,
      minimum: 0,
    })
    @IsNumber()
    @Type(() => Number)
    @Min(0)
    offset: number;
  }
  return RequiredPaginationDto;
}

export class BasicPaginationDto extends createPaginationDto(50) {}
export class LargePaginationDto extends createPaginationDto(1000) {}
export class RequiredPaginationDto extends createRequiredPaginationDto(50) {}
export class RequiredLargePaginationDto extends createRequiredPaginationDto(
  1000,
) {}
