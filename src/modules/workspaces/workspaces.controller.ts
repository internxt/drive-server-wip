import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotImplementedException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { WorkspacesUsecases } from './workspaces.usecase';
import { CreateTeamDto } from './dto/create-team.dto';
import { WorkspaceAttributes } from './attributes/workspace.attributes';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { User } from '../user/user.domain';
import { isUUID } from 'class-validator';
import { EditTeamDto } from './dto/edit-team-data.dto';
import { UserAttributes } from '../user/user.attributes';
import { WorkspaceTeamAttributes } from './attributes/workspace-team.attributes';
import { WorkspaceGuard } from './guards/workspaces.guard';
import {
  AccessContext,
  WorkspaceRequiredAccess,
  WorkspaceRole,
} from './guards/workspace-required-access.decorator';
import { CreateWorkspaceInviteDto } from './dto/create-workspace-invite.dto';
import { ChangeUserRoleDto } from './dto/change-user-role.dto';
import { SetupWorkspaceDto } from './dto/setup-workspace.dto';
import { AcceptWorkspaceInviteDto } from './dto/accept-workspace-invite.dto';

@ApiTags('Workspaces')
@Controller('workspaces')
export class WorkspacesController {
  constructor(private workspaceUseCases: WorkspacesUsecases) {}

  @Get('/')
  @ApiOperation({
    summary: 'Get available workspaces for the user',
  })
  @ApiOkResponse({
    description: 'Available workspaces and workspaceUser',
  })
  async getAvailableWorkspaces(@UserDecorator() user: User) {
    return this.workspaceUseCases.getAvailableWorkspaces(user);
  }

  @Get('/pending-setup')
  @ApiOperation({
    summary: 'Get owner workspaces ready to be setup',
  })
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'Workspaces pending to be setup',
  })
  async getUserWorkspacesToBeSetup(@UserDecorator() user: User) {
    return this.workspaceUseCases.getWorkspacesPendingToBeSetup(user);
  }

  @Patch('/:workspaceId/setup')
  @ApiOperation({
    summary: 'Set up workspace that has been initialized',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiOkResponse({
    description: 'Workspace setup',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.OWNER)
  async setupWorkspace(
    @UserDecorator() user: User,
    @Param('workspaceId') workspaceId: WorkspaceAttributes['id'],
    @Body() setupWorkspaceDto: SetupWorkspaceDto,
  ) {
    if (!workspaceId || !isUUID(workspaceId)) {
      throw new BadRequestException('Invalid workspace ID');
    }

    return this.workspaceUseCases.setupWorkspace(
      user,
      workspaceId,
      setupWorkspaceDto,
    );
  }

  @Post('/:workspaceId/members/invite')
  @ApiOperation({
    summary: 'Invite user to a workspace',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiOkResponse({
    description: 'User has been invited successfully',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.OWNER)
  async inviteUsersToWorkspace(
    @Param('workspaceId') workspaceId: WorkspaceAttributes['id'],
    @Body() createInviteDto: CreateWorkspaceInviteDto,
    @UserDecorator() user: User,
  ) {
    return this.workspaceUseCases.inviteUserToWorkspace(
      user,
      workspaceId,
      createInviteDto,
    );
  }

  @Post('/:workspaceId/teams')
  @ApiOperation({
    summary: 'Creates a team in a workspace',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.OWNER)
  async createTeam(
    @Param('workspaceId') workspaceId: WorkspaceAttributes['id'],
    @Body() createTeamBody: CreateTeamDto,
    @UserDecorator() user: User,
  ) {
    if (!workspaceId || !isUUID(workspaceId)) {
      throw new BadRequestException('Invalid workspace ID');
    }

    return this.workspaceUseCases.createTeam(user, workspaceId, createTeamBody);
  }

  @Get('/:workspaceId/teams')
  @ApiOperation({
    summary: 'Gets workspace teams',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiOkResponse({
    description: 'Teams in the workspace along with its members quantity',
  })
  async getWorkspaceTeams(
    @Param('workspaceId') workspaceId: WorkspaceAttributes['id'],
    @UserDecorator() user: User,
  ) {
    if (!workspaceId || !isUUID(workspaceId)) {
      throw new BadRequestException('Invalid workspace ID');
    }

    return this.workspaceUseCases.getWorkspaceTeams(user, workspaceId);
  }

  @Get('/teams/:teamId/members')
  @ApiOperation({
    summary: 'Gets team members',
  })
  @ApiOkResponse({
    description: 'Members of the team',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async getTeamMembers(@Param('teamId') teamId: WorkspaceTeamAttributes['id']) {
    if (!teamId) {
      throw new BadRequestException('Invalid team ID');
    }
    return this.workspaceUseCases.getTeamMembers(teamId);
  }

  @Patch('/teams/:teamId')
  @ApiOperation({
    summary: 'Edits team data',
  })
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'Team has been edited',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.TEAM, WorkspaceRole.MANAGER)
  async editTeam(
    @Param('teamId') teamId: WorkspaceTeamAttributes['id'],
    @Body() editTeamBody: EditTeamDto,
  ) {
    if (!teamId) {
      throw new BadRequestException('Invalid team ID');
    }
    if (!editTeamBody) {
      throw new BadRequestException('Invalid edit team data');
    }
    return this.workspaceUseCases.editTeamData(teamId, editTeamBody);
  }

  @Delete('/teams/:teamId')
  @ApiOperation({
    summary: 'Deletes a team in a workspace',
  })
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'Deleted team',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.OWNER)
  async deleteTeam(@Param('teamId') teamId: WorkspaceTeamAttributes['id']) {
    if (!teamId) {
      throw new BadRequestException('Invalid team ID');
    }
    return this.workspaceUseCases.deleteTeam(teamId);
  }

  @Post('/teams/:teamId/user/:userUuid')
  @ApiOperation({
    summary: 'Add a user to a team',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'teamId', type: String, required: true })
  @ApiParam({ name: 'userUuid', type: String, required: true })
  @ApiOkResponse({
    description: 'User added to team',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.TEAM, WorkspaceRole.MANAGER)
  async addUserToTeam(
    @Param('teamId') teamId: WorkspaceTeamAttributes['id'],
    @Param('userUuid') memberId: UserAttributes['uuid'],
  ) {
    if (!teamId || !isUUID(teamId)) {
      throw new BadRequestException('Invalid team id');
    }

    if (!memberId || !isUUID(memberId)) {
      throw new BadRequestException('Invalid User Uuid');
    }
    const newTeamMember = await this.workspaceUseCases.addMemberToTeam(
      teamId,
      memberId,
    );

    return newTeamMember;
  }

  @Delete('/teams/:teamId/user/:userUuid')
  @ApiOperation({
    summary: 'Remove user from team',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'teamId', type: String, required: true })
  @ApiParam({ name: 'userUuid', type: String, required: true })
  @ApiOkResponse({
    description: 'User removed from team',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.TEAM, WorkspaceRole.MANAGER)
  async removeUserFromTeam(
    @Param('teamId') teamId: WorkspaceTeamAttributes['id'],
    @Param('userUuid') memberId: UserAttributes['uuid'],
  ) {
    if (!teamId || !isUUID(teamId)) {
      throw new BadRequestException('Invalid Team id');
    }

    if (!memberId || !isUUID(memberId)) {
      throw new BadRequestException('Invalid User Uuid');
    }
    return this.workspaceUseCases.removeMemberFromTeam(teamId, memberId);
  }

  @Patch('/teams/:teamId/manager')
  @ApiOperation({
    summary: 'Changes the manager of a team',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'teamId', type: String, required: true })
  @ApiOkResponse({
    description: 'Team manager changed',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.OWNER)
  async changeTeamManager(
    @Param('teamId') teamId: WorkspaceTeamAttributes['id'],
    @Body('managerId') managerId: UserAttributes['uuid'],
  ) {
    if (!managerId || !isUUID(managerId)) {
      throw new BadRequestException('Invalid Manager Uuid');
    }
    return this.workspaceUseCases.changeTeamManager(teamId, managerId);
  }

  @Patch('/:workspaceId/teams/:teamId/members/:memberId/role')
  @ApiOperation({
    summary: 'Changes the role of a member in the workspace',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiParam({ name: 'teamId', type: String, required: true })
  @ApiParam({ name: 'memberId', type: String, required: true })
  @ApiOkResponse({
    description: 'Role changed',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.OWNER)
  async changeMemberRole(
    @Param('workspaceId') workspaceId: WorkspaceAttributes['id'],
    @Param('teamId') teamId: WorkspaceTeamAttributes['id'],
    @Param('memberId') userUuid: User['uuid'],
    @Body() changeUserRoleBody: ChangeUserRoleDto,
  ) {
    if (!userUuid || !isUUID(userUuid)) {
      throw new BadRequestException('Invalid User Uuid');
    }

    return this.workspaceUseCases.changeUserRole(
      workspaceId,
      teamId,
      userUuid,
      changeUserRoleBody,
    );
  }

  @Post('/invitations/accept')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Accepts invitation to workspace',
  })
  @ApiOkResponse({
    description: 'Workspace invitation accepted',
  })
  async acceptWorkspaceInvitation(
    @UserDecorator() user: User,
    @Body() acceptInvitationDto: AcceptWorkspaceInviteDto,
  ) {
    const { inviteId } = acceptInvitationDto;

    return this.workspaceUseCases.acceptWorkspaceInvite(user, inviteId);
  }
}
