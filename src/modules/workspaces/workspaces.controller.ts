import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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
import { ValidateUUIDPipe } from './pipes/validate-uuid.pipe';
import { WorkspaceInviteAttributes } from './attributes/workspace-invite.attribute';

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
  @ApiBearerAuth()
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

  @Delete('/invitations/:inviteId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Declines invitation to workspace',
  })
  @ApiParam({ name: 'inviteId', type: String, required: true })
  @ApiOkResponse({
    description: 'Workspace invitation declined',
  })
  async removeWorkspaceInvite(
    @UserDecorator() user: User,
    @Param('inviteId', ValidateUUIDPipe)
    inviteId: WorkspaceInviteAttributes['id'],
  ) {
    return this.workspaceUseCases.removeWorkspaceInvite(user, inviteId);
  }

  @Get('/teams/:teamId/members')
  @ApiOperation({
    summary: 'Gets team members',
  })
  @ApiOkResponse({
    description: 'Members of the team',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.TEAM, WorkspaceRole.MEMBER)
  async getTeamMembers(
    @Param('teamId', ValidateUUIDPipe) teamId: WorkspaceTeamAttributes['id'],
  ) {
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
    @Param('teamId', ValidateUUIDPipe) teamId: WorkspaceTeamAttributes['id'],
    @Body() editTeamBody: EditTeamDto,
  ) {
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
  async deleteTeam(
    @Param('teamId', ValidateUUIDPipe) teamId: WorkspaceTeamAttributes['id'],
  ) {
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
    @Param('teamId', ValidateUUIDPipe) teamId: WorkspaceTeamAttributes['id'],
    @Param('userUuid', ValidateUUIDPipe) memberId: UserAttributes['uuid'],
  ) {
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
    @Param('teamId', ValidateUUIDPipe) teamId: WorkspaceTeamAttributes['id'],
    @Param('userUuid', ValidateUUIDPipe) memberId: UserAttributes['uuid'],
  ) {
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
    @Param('teamId', ValidateUUIDPipe) teamId: WorkspaceTeamAttributes['id'],
    @Body('managerId', ValidateUUIDPipe) managerId: UserAttributes['uuid'],
  ) {
    return this.workspaceUseCases.changeTeamManager(teamId, managerId);
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
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @Body() setupWorkspaceDto: SetupWorkspaceDto,
  ) {
    return this.workspaceUseCases.setupWorkspace(
      user,
      workspaceId,
      setupWorkspaceDto,
    );
  }

  @Get('/:workspaceId/members')
  @ApiOperation({
    summary: 'Gets workspace members',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiOkResponse({
    description: 'Members in the workspace along with members quantity',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.OWNER)
  async getWorkspaceMembers(
    @Param('workspaceId') workspaceId: WorkspaceAttributes['id'],
    @UserDecorator() user: User,
  ) {
    if (!workspaceId || !isUUID(workspaceId)) {
      throw new BadRequestException('Invalid workspace ID');
    }

    return this.workspaceUseCases.getWorkspaceMembers(workspaceId, user);
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
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
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
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @Body() createTeamBody: CreateTeamDto,
    @UserDecorator() user: User,
  ) {
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
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @UserDecorator() user: User,
  ) {
    if (!workspaceId || !isUUID(workspaceId)) {
      throw new BadRequestException('Invalid workspace ID');
    }

    return this.workspaceUseCases.getWorkspaceTeams(user, workspaceId);
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
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @Param('teamId', ValidateUUIDPipe) teamId: WorkspaceTeamAttributes['id'],
    @Param('memberId', ValidateUUIDPipe) userUuid: User['uuid'],
    @Body() changeUserRoleBody: ChangeUserRoleDto,
  ) {
    return this.workspaceUseCases.changeUserRole(
      workspaceId,
      teamId,
      userUuid,
      changeUserRoleBody,
    );
  }

  @Get(':workspaceId/members/:memberId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Gets workspace member details',
  })
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiParam({ name: 'memberId', type: String, required: true })
  @ApiOkResponse({
    description: 'Details of the workspace members',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async getWorkspaceMemberDetails(
    @Param('memberId', ValidateUUIDPipe)
    memberId: WorkspaceTeamAttributes['id'],
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
  ) {
    return this.workspaceUseCases.getMemberDetails(workspaceId, memberId);
  }

  @Patch(':workspaceId/members/:memberId/deactivate')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Deactivate user from workspace',
  })
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiParam({ name: 'memberId', type: String, required: true })
  @ApiOkResponse({
    description: 'User successfully deactivated',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.OWNER)
  async deactivateWorkspaceMember(
    @Param('memberId', ValidateUUIDPipe)
    memberId: WorkspaceTeamAttributes['id'],
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @UserDecorator() user: User,
  ) {
    return this.workspaceUseCases.deactivateWorkspaceUser(
      user,
      memberId,
      workspaceId,
    );
  }
}
