import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { Workspace } from '../domains/workspaces.domain';

export class EditWorkspaceDetailsDto {
  @ApiProperty({
    example: 'Internxt',
    description: 'Name of the workspace',
  })
  @IsOptional()
  @IsString()
  @Length(3, 50)
  name?: Workspace['name'];

  @ApiProperty({
    example:
      'Our goal is to create a cloud storage ecosystem that gives users total control, security, and privacy of the files and information online.',
    description: 'Description of the workspace',
  })
  @IsOptional()
  @IsString()
  @Length(0, 150)
  description?: Workspace['description'];
}
