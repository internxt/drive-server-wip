import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';
import { Workspace } from '../domains/workspaces.domain';

export class CreateWorkSpaceDto {
  @ApiProperty({
    example: 'Designers team',
    description: 'Name of the team to be created',
  })
  @IsNotEmpty()
  name: Workspace['name'];

  @ApiProperty({
    example: '312312231',
    description: 'Space to allocate to workspace in bytes',
  })
  @IsNotEmpty()
  @IsNumber()
  space: number;
}
