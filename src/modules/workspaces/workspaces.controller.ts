import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotImplementedException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { WorkspacesUsecases } from './workspaces.usecase';
import { CreateTeamDto } from './dto/create-team.dto';
import { WorkspaceAttributes } from './attributes/workspace.attributes';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { User } from '../user/user.domain';
import { isUUID } from 'class-validator';
import { WorkspaceGuard } from './guards/workspaces.guard';
import {
  AccessContext,
  WorkspaceRequiredAccess,
  WorkspaceRole,
} from './guards/workspace-required-access.decorator';
import { CreateWorkspaceInviteDto } from './dto/create-workspace-invite.dto';
import { WorkspaceTeamAttributes } from './attributes/workspace-team.attributes';
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

  @Get('/:workspaceId/members')
  @ApiOperation({
    summary: 'Gets workspace members',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiQuery({
    name: 'search',
    description: 'Search users by name, lastname or email',
    required: false,
    type: String,
  })
  @ApiOkResponse({
    description: 'Members in the workspace along with members quantity',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.OWNER)
  async getWorkspaceMembers(
    @Param('workspaceId') workspaceId: WorkspaceAttributes['id'],
    @UserDecorator() user: User,
    @Query('search') search: string | null = null,
  ) {
    if (!workspaceId || !isUUID(workspaceId)) {
      throw new BadRequestException('Invalid workspace ID');
    }

    return this.workspaceUseCases.getWorkspaceMembers(
      workspaceId,
      user,
      search,
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
    description: 'Teams in the workspace along with members quantity',
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

  @Get('/:workspaceId/teams/:teamId/members')
  @ApiBearerAuth()
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.TEAM, WorkspaceRole.MEMBER)
  async getTeamMembers() {
    throw new NotImplementedException();
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
