import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class InitializeWorkspaceDto {
  @ApiProperty({
    example: 'Id of the owner',
    description: 'Uuid of the owner of the space',
  })
  @IsNotEmpty()
  ownerId: string;

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
    example: 'hello@internxt.com',
    description: 'Email',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

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
