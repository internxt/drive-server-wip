import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { WorkspaceRole } from '../guards/workspace-required-access.decorator';

export class ChangeUserRoleDto {
  @ApiProperty({
    example: 'TEAM_MANAGER',
    description: 'Role to be assigned to user',
  })
  @IsNotEmpty()
  role: Omit<WorkspaceRole, 'OWNER'>;
}
