import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { PreCreatedUserStatus } from '../../user/pre-created-users.attributes';

export class UpdatePreCreatedUserDto {
  @ApiProperty({
    example: 'f9d113e3-8267-4419-a309-9b601f4f6f9b',
    description: 'UUID of the pre-created user',
  })
  @IsUUID()
  uuid: string;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'UUID of the tier',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  tierId?: string;

  @ApiProperty({
    example: 3298534883328,
    description: 'Extra space to add to user in bytes',
    required: false,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  @IsNumber()
  @IsOptional()
  maxSpaceBytes?: number;

  @ApiProperty({
    example: 'awaiting_payment',
    description: 'The status of the pre-created user',
    required: false,
    enum: PreCreatedUserStatus,
  })
  @IsEnum(PreCreatedUserStatus)
  @IsOptional()
  status?: PreCreatedUserStatus;
}
