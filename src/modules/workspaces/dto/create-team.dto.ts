import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional } from 'class-validator';
import { type WorkspaceTeam } from '../domains/workspace-team.domain';

export class CreateTeamDto {
  @ApiProperty({
    example: 'Designers team',
    description: 'Name of the team to be created',
  })
  @IsNotEmpty()
  name: WorkspaceTeam['name'];

  @ApiProperty({
    example: 'e54c5cc0-3a12-4537-9646-251ec0f0dbe4',
    description: 'Uuid of the user to assign as manager',
  })
  @IsOptional()
  managerId?: WorkspaceTeam['name'];
}
