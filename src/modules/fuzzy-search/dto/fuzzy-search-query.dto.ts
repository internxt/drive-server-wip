import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import { FileCategory } from '../file-categories';

function IsGreaterOrEqualThanMinSize(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isGreaterOrEqualThanMinSize',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const { minSize } = args.object as FuzzySearchQueryDto;
          if (minSize === undefined || typeof value !== 'number') {
            return true;
          }
          return value >= minSize;
        },
        defaultMessage() {
          return 'maxSize must be greater than or equal to minSize';
        },
      },
    });
  };
}

export class FuzzySearchQueryDto {
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

  @ApiProperty({
    description:
      'File categories to filter by (single value or repeated param)',
    enum: FileCategory,
    isArray: true,
    required: false,
    example: ['image', 'pdf'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(FileCategory, {
    each: true,
    message: (args: ValidationArguments) =>
      `Unknown type "${args.value}". Allowed values are: ${Object.values(
        FileCategory,
      ).join(', ')}`,
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return [value];
    }
    return value;
  })
  type?: FileCategory[];

  @ApiProperty({
    description: 'Minimum file size in bytes (folders are excluded)',
    example: 5242880,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  minSize?: number;

  @ApiProperty({
    description: 'Maximum file size in bytes (folders are excluded)',
    example: 1073741824,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  @IsGreaterOrEqualThanMinSize()
  maxSize?: number;

  @ApiProperty({
    description: 'Filter items modified after this date',
    example: '2026-01-01T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'Invalid date format for modifiedAfter' })
  modifiedAfter?: string;

  @ApiProperty({
    description: 'Filter items modified before this date',
    example: '2026-06-30T23:59:59.999Z',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'Invalid date format for modifiedBefore' })
  modifiedBefore?: string;
}
