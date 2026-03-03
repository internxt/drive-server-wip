import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { type WorkspaceTeam } from '../domains/workspace-team.domain';

export class EditTeamDto {
  @ApiProperty({
    example: 'Designers team',
    description: 'New name of the team',
  })
  @IsNotEmpty()
  @IsString()
  name: WorkspaceTeam['name'];
}
