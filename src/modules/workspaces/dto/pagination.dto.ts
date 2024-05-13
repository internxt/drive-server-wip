import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  offset?: number;
}
