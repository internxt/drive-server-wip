import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotImplementedException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspacesUsecases } from './workspaces.usecase';
import { CreateTeamDto } from './dto/create-team.dto';
import { WorkspaceAttributes } from './attributes/workspace.attributes';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { User } from '../user/user.domain';
import { isUUID } from 'class-validator';

@ApiTags('Workspaces')
@Controller('workspaces')
export class WorkspacesController {
  constructor(private workspaceUseCases: WorkspacesUsecases) {}

  @Patch('/:workspaceId')
  async setupWorkspace(
    @Param('workspaceId') workspaceId: WorkspaceAttributes['id'],
  ) {
    throw new NotImplementedException();
  }

  @Post('/:workspaceId/teams')
  @ApiOperation({
    summary: 'Creates a team in a workspace',
  })
  @ApiOkResponse({
    description: 'Created team',
  })
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

  @Get('/:workspaceId/teams/:teamId/members')
  async getTeamMembers() {
    throw new NotImplementedException();
  }
}
