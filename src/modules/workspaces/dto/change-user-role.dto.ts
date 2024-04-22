import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { WorkspaceRole } from '../guards/workspace-required-access.decorator';

export class ChangeUserRoleDto {
  @ApiProperty({
    example: 'MANAGER',
    description: 'Role to be assigned to user in the team',
    enum: Object.values(WorkspaceRole).filter(
      (role) => role != WorkspaceRole.OWNER,
    ),
  })
  @IsNotEmpty()
  role: Omit<WorkspaceRole, 'OWNER'>;
}
