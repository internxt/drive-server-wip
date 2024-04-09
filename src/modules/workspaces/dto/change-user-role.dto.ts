import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { User } from '../../user/user.domain';
import { WorkspaceRole } from '../guards/workspace-required-access.decorator';

export class ChangeUserRoleDto {
  @ApiProperty({
    example: 'User Id',
    description: 'Uuid of user to modify',
  })
  @IsNotEmpty()
  userId: User['uuid'];

  @ApiProperty({
    example: 'TEAM_MANAGER',
    description: 'Role to be assigned to user',
  })
  @IsNotEmpty()
  role: Omit<WorkspaceRole, 'OWNER'>;
}
