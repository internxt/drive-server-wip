import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { OrderBy } from './../../../common/order.type';
import { WorkspaceLogType } from '../attributes/workspace-logs.attributes';
import { Transform, Type } from 'class-transformer';

export class GetWorkspaceLogsDto {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(WorkspaceLogType, { each: true })
  activity?: WorkspaceLogType[];

  @ApiPropertyOptional({
    description: 'Order by',
    example: 'name:asc',
  })
  @IsOptional()
  @IsString()
  orderBy?: OrderBy;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number;

  @IsOptional()
  @IsString()
  member?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  @Type(() => Number)
  lastDays?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  summary?: boolean = true;
}
