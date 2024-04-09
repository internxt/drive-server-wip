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
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
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

@ApiTags('Workspaces')
@Controller('workspaces')
export class WorkspacesController {
  constructor(private workspaceUseCases: WorkspacesUsecases) {}

  @Patch('/:workspaceId')
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.OWNER)
  async setupWorkspace(
    @Param('workspaceId') workspaceId: WorkspaceAttributes['id'],
  ) {
    throw new NotImplementedException();
  }

  @Post('/:workspaceId/members/invite')
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
  @ApiOkResponse({
    description: 'Created team',
  })
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

  @Get('/teams/:teamId/members')
  async getTeamMembers(
    @Param('teamId') teamId: WorkspaceTeamAttributes['id'],
    @UserDecorator() user: User,
  ) {
    return this.workspaceUseCases.getTeamMembers(teamId);
  }

  @Patch('/teams/:teamId')
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.OWNER)
  async editTeam(
    @Param('teamId') teamId: WorkspaceTeamAttributes['id'],
    @Body() editTeamBody: EditTeamDto,
  ) {
    return this.workspaceUseCases.editTeamData(teamId, editTeamBody);
  }

  @Delete('/teams/:teamId')
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.OWNER)
  async deleteTeam(@Param('teamId') teamId: WorkspaceTeamAttributes['id']) {
    return this.workspaceUseCases.deleteTeam(teamId);
  }

  @Post('/teams/:teamId/user/:userUuid')
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MANAGER)
  async inviteUser(
    @Param('teamId') teamId: WorkspaceTeamAttributes['id'],
    @Param('userUuid') memberId: UserAttributes['uuid'],
  ) {
    return this.workspaceUseCases.addMemberToTeam(teamId, memberId);
  }

  @Delete('/teams/:teamId/user/:userUuid')
  async removeUserFromTeam(
    @Param('teamId') teamId: WorkspaceTeamAttributes['id'],
    @Param('userUuid') memberId: UserAttributes['uuid'],
  ) {
    return this.workspaceUseCases.removeMemberFromTeam(teamId, memberId);
  }

  @Patch('/teams/:teamId/manager')
  async changeTeamManager(
    @Param('teamId') teamId: WorkspaceTeamAttributes['id'],
    @Body('managerId') managerId: UserAttributes['uuid'],
  ) {
    return this.workspaceUseCases.changeTeamManager(teamId, managerId);
  }

  // @Get('/:workspaceId/teams/:teamId/members')
  // @UseGuards(WorkspaceGuard)
  // @WorkspaceRequiredAccess(AccessContext.TEAM, WorkspaceRole.MEMBER)
  // async getTeamMembers() {
  //   throw new NotImplementedException();
  // }
}
