import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsUUID } from 'class-validator';

export class InitializeWorkspaceDto {
  @ApiProperty({
    example: 'Id of the owner',
    description: 'Uuid of the owner of the space',
  })
  @IsNotEmpty()
  ownerId: string;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Tier ID for the workspace',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  tierId?: string;

  @ApiProperty({
    example: 'Address from billing',
    description: 'Address of the workspace',
  })
  @IsOptional()
  address?: string;

  @ApiProperty({
    example: '+34 622 111 333',
    description: 'Phone number',
  })
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({
    example: 312321312,
    description: 'Workspace max space in bytes',
  })
  @IsNotEmpty()
  @IsNumber()
  maxSpaceBytes: number;

  @ApiProperty({
    example: 20,
    description: 'Workspace max number of users',
  })
  @IsNotEmpty()
  @IsNumber()
  numberOfSeats: number;
}
