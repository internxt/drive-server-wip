import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class UpdateWorkspaceDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'UUID of the owner of the workspace',
  })
  @IsNotEmpty()
  @IsUUID()
  ownerId: string;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Tier ID to update workspace tier',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  tierId?: string;

  @ApiProperty({
    example: '312321312',
    description:
      'Workspace max space in bytes (required if numberOfSeats is provided)',
    required: false,
  })
  @ValidateIf(
    (o) => o.numberOfSeats !== undefined || o.maxSpaceBytes !== undefined,
  )
  @IsNotEmpty({
    message: 'maxSpaceBytes is required when numberOfSeats is provided',
  })
  @IsNumber()
  maxSpaceBytes?: number;

  @ApiProperty({
    example: '5',
    description:
      'Number of seats in the workspace (required if maxSpaceBytes is provided)',
    required: false,
  })
  @ValidateIf(
    (o) => o.maxSpaceBytes !== undefined || o.numberOfSeats !== undefined,
  )
  @IsNotEmpty({
    message: 'numberOfSeats is required when maxSpaceBytes is provided',
  })
  @IsNumber()
  numberOfSeats?: number;
}
