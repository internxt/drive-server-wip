import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  Query,
  UseGuards,
  UseInterceptors,
  InternalServerErrorException,
  UseFilters,
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
import { EditWorkspaceDetailsDto } from './dto/edit-workspace-details-dto';
import { WorkspaceInviteAttributes } from './attributes/workspace-invite.attribute';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  FolderAttributes,
  SortableFolderAttributes,
} from '../folder/folder.domain';
import { CreateWorkspaceFolderDto } from './dto/create-workspace-folder.dto';
import { CreateWorkspaceFileDto } from './dto/create-workspace-file.dto';
import { PaginationQueryDto } from './dto/pagination.dto';
import { SortableFileAttributes } from '../file/file.domain';
import { avatarStorageS3Config } from '../../externals/multer';
import { WorkspaceInvitationsPagination } from './dto/workspace-invitations-pagination.dto';
import { ExtendedHttpExceptionFilter } from '../../common/http-exception-filter-extended.exception';
import { WorkspaceItemType } from './attributes/workspace-items-users.attributes';
import { WorkspaceUserAttributes } from './attributes/workspace-users.attributes';
import { ChangeUserAssignedSpaceDto } from './dto/change-user-assigned-space.dto';

@ApiTags('Workspaces')
@Controller('workspaces')
@UseFilters(ExtendedHttpExceptionFilter)
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

  @Get('/invitations/')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user pending invitations',
  })
  @ApiOkResponse({
    description: 'User Pending invitations',
  })
  async getUserInvitations(
    @UserDecorator() user: User,
    @Query() paginationLimit: WorkspaceInvitationsPagination,
  ) {
    const { limit, offset } = paginationLimit;

    return this.workspaceUseCases.getUserInvites(user, limit, offset);
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

  @Get('/invitations/:inviteId/validate')
  @ApiOperation({
    summary: 'Validates if invitation is valid',
  })
  @ApiOkResponse({
    description: 'Workspace invitation is valid',
  })
  validateWorkspaceInvitation(
    @Param('inviteId', ValidateUUIDPipe)
    inviteId: WorkspaceInviteAttributes['id'],
  ) {
    return this.workspaceUseCases.validateWorkspaceInvite(inviteId);
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

  @Get('/:workspaceId/invitations')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get workspace pending invitations',
  })
  @ApiOkResponse({
    description: 'Workspace pending invitations',
  })
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.OWNER)
  async getWorkspacePendingInvitations(
    @Query() pagination: WorkspaceInvitationsPagination,
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
  ) {
    const { limit, offset } = pagination;

    return this.workspaceUseCases.getWorkspacePendingInvitations(
      workspaceId,
      limit,
      offset,
    );
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

  @Post('/:workspaceId/avatar')
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiOkResponse({
    description: 'Avatar added to the workspace',
  })
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.OWNER)
  @UseGuards(WorkspaceGuard)
  @UseInterceptors(FileInterceptor('file', avatarStorageS3Config))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File | any,
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
  ) {
    const { key } = file;
    if (!key) {
      throw new InternalServerErrorException('File could not be uploaded');
    }
    return this.workspaceUseCases.upsertAvatar(workspaceId, key);
  }

  @Delete('/:workspaceId/avatar')
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiOkResponse({
    description: 'Avatar deleted from the workspace',
  })
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.OWNER)
  @UseGuards(WorkspaceGuard)
  async deleteAvatar(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
  ) {
    return this.workspaceUseCases.deleteAvatar(workspaceId);
  }

  @Get('/:workspaceId/credentials')
  @ApiOperation({
    summary: 'Gets workspace credentials',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiOkResponse({
    description: 'Workspace credentials',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async getWorkspaceUser(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
  ) {
    return this.workspaceUseCases.getWorkspaceCredentials(workspaceId);
  }

  @Get('/:workspaceId/usage')
  @ApiOperation({
    summary: 'Gets workspace usage',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiOkResponse({
    description: 'Returns workspace usage',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.OWNER)
  async getWorkspaceStorageUsage(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
  ) {
    const workspace = await this.workspaceUseCases.findById(workspaceId);

    if (!workspace) {
      throw new BadRequestException('Workspace not valid');
    }

    return this.workspaceUseCases.getWorkspaceUsage(workspace);
  }

  @Patch('/:workspaceId/members/:memberId/usage')
  @ApiOperation({
    summary: 'Change workspace member assigned space',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.OWNER)
  async changeMemberAssignedSpace(
    @Param('workspaceId') workspaceId: WorkspaceAttributes['id'],
    @Param('memberId') memberId: WorkspaceUserAttributes['memberId'],
    @Body() assignSpaceToUserDto: ChangeUserAssignedSpaceDto,
  ) {
    return this.workspaceUseCases.changeUserAssignedSpace(
      workspaceId,
      memberId,
      assignSpaceToUserDto,
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
    @Query('search') search?: string,
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

  @Post('/:workspaceId/files')
  @ApiOperation({
    summary: 'Create File',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiOkResponse({
    description: 'Created File',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async createFile(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @UserDecorator() user: User,
    @Body() createFileDto: CreateWorkspaceFileDto,
  ) {
    return this.workspaceUseCases.createFile(user, workspaceId, createFileDto);
  }

  @Post('/:workspaceId/folders')
  @ApiOperation({
    summary: 'Create folder',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiOkResponse({
    description: 'Created Folder',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async createFolder(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @UserDecorator() user: User,
    @Body() createFolderDto: CreateWorkspaceFolderDto,
  ) {
    return this.workspaceUseCases.createFolder(
      user,
      workspaceId,
      createFolderDto,
    );
  }

  @Get('/:workspaceId/trash')
  @ApiOperation({
    summary: 'Get current workspace user trash',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiOkResponse({
    description: "user's trashed items in workspace",
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async getUserTrashedItems(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @UserDecorator() user: User,
    @Query() pagination: PaginationQueryDto,
    @Query('type') type: WorkspaceItemType,
  ) {
    const { limit, offset } = pagination;

    return this.workspaceUseCases.getWorkspaceUserTrashedItems(
      user,
      workspaceId,
      type,
      limit,
      offset,
    );
  }

  @Delete('/:workspaceId/trash')
  @ApiOperation({
    summary: 'Empty current member trash',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiOkResponse({
    description:
      "Member's trashed items in workspace have been successfully removed",
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async emptyTrash(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @UserDecorator() user: User,
  ) {
    return this.workspaceUseCases.emptyUserTrashedItems(user, workspaceId);
  }

  @Get('/:workspaceId/folders/:folderUuid/folders')
  @ApiOperation({
    summary: 'Get folders in folder',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiParam({ name: 'folderUuid', type: String, required: true })
  @ApiOkResponse({
    description: 'Folders in folder',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async getFoldersInFolder(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @Param('folderUuid', ValidateUUIDPipe)
    folderUuid: FolderAttributes['uuid'],
    @UserDecorator() user: User,
    @Query() pagination: PaginationQueryDto,
    @Query('sort') sort?: SortableFolderAttributes,
    @Query('order') order?: 'ASC' | 'DESC',
  ) {
    const { limit, offset } = pagination;

    return this.workspaceUseCases.getPersonalWorkspaceFoldersInFolder(
      user,
      workspaceId,
      folderUuid,
      limit,
      offset,
      { sort, order },
    );
  }

  @Get('/:workspaceId/folders/:folderUuid/files')
  @ApiOperation({
    summary: 'Get files in folder',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiParam({ name: 'folderUuid', type: String, required: true })
  @ApiOkResponse({
    description: 'Files in folder',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async getFilesInFolder(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @Param('folderUuid', ValidateUUIDPipe)
    folderUuid: FolderAttributes['uuid'],
    @UserDecorator() user: User,
    @Query() pagination: PaginationQueryDto,
    @Query('sort') sort?: SortableFileAttributes,
    @Query('order') order?: 'ASC' | 'DESC',
  ) {
    const { limit, offset } = pagination;
    return this.workspaceUseCases.getPersonalWorkspaceFilesInFolder(
      user,
      workspaceId,
      folderUuid,
      limit,
      offset,
      { sort, order },
    );
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
  @Patch('/:workspaceId')
  @ApiOperation({
    summary: 'Edit workspace details',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.OWNER)
  editWorkspaceDetails(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @UserDecorator() user: User,
    @Body() editWorkspaceBody: EditWorkspaceDetailsDto,
  ) {
    return this.workspaceUseCases.editWorkspaceDetails(
      workspaceId,
      user,
      editWorkspaceBody,
    );
  }

  @Delete('/:workspaceId/members/leave')
  @ApiOperation({
    summary: 'Leave a workspace',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiOkResponse({
    description: 'User left workspace',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async leaveWorkspace(
    @UserDecorator() user: User,
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
  ) {
    return this.workspaceUseCases.leaveWorkspace(workspaceId, user);
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
