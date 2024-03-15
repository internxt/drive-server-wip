import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Team } from '../domains/team.domain';

export class EditTeamDto {
  @ApiProperty({
    example: 'Designers team',
    description: 'New name of the team',
  })
  @IsNotEmpty()
  @IsString()
  name: Team['name'];
}
