import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsUUID } from 'class-validator';

export class CheckStorageExpansionDto {
  @ApiProperty({
    example: 'f9d113e3-8267-4419-a309-9b601f4f6f9b',
    description: 'UUID of the user',
  })
  @IsUUID()
  userUuid: string;

  @ApiProperty({
    example: 3298534883328,
    description: 'Extra space to add to user in bytes',
    required: false,
  })
  @IsNumber()
  @Transform(({ value }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  additionalBytes?: number;
}
