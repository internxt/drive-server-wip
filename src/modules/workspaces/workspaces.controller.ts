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
  ForbiddenException,
  NotFoundException,
  DefaultValuePipe,
  ParseIntPipe,
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
import { type WorkspaceAttributes } from './attributes/workspace.attributes';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { UserTier } from '../auth/decorators/user-tier.decorator';
import { User } from '../user/user.domain';
import { isUUID } from 'class-validator';
import { EditTeamDto } from './dto/edit-team-data.dto';
import { type UserAttributes } from '../user/user.attributes';
import { type WorkspaceTeamAttributes } from './attributes/workspace-team.attributes';
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
import { ValidateUUIDPipe } from '../../common/pipes/validate-uuid.pipe';
import { EditWorkspaceDetailsDto } from './dto/edit-workspace-details-dto';
import { type WorkspaceInviteAttributes } from './attributes/workspace-invite.attribute';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  type Folder,
  type FolderAttributes,
  FolderStatus,
  SortableFolderAttributes,
} from '../folder/folder.domain';
import { CreateWorkspaceFolderDto } from './dto/create-workspace-folder.dto';
import { CreateWorkspaceFileDto } from './dto/create-workspace-file.dto';
import { SortableFileAttributes } from '../file/file.domain';
import { avatarStorageS3Config } from '../../externals/multer';
import { WorkspaceInvitationsPagination } from './dto/workspace-invitations-pagination.dto';
import { ShareItemWithTeamDto } from './dto/share-item-with-team.dto';
import { OrderBy } from '../../common/order.type';
import { GetDataFromRequest } from './../../common/extract-data-from-request';
import { SharingPermissionsGuard } from '../sharing/guards/sharing-permissions.guard';
import { RequiredSharingPermissions } from '../sharing/guards/sharing-permissions.decorator';
import { type Sharing, SharingActionName } from '../sharing/sharing.domain';
import { WorkspaceItemType } from './attributes/workspace-items-users.attributes';
import { type WorkspaceUserAttributes } from './attributes/workspace-users.attributes';
import { ChangeUserAssignedSpaceDto } from './dto/change-user-assigned-space.dto';
import { Public } from '../auth/decorators/public.decorator';
import { BasicPaginationDto } from '../../common/dto/basic-pagination.dto';
import { GetSharedItemsDto } from './dto/get-shared-items.dto';
import { GetSharedWithDto } from './dto/shared-with.dto';
import { GetWorkspaceFilesQueryDto } from './dto/get-workspace-files.dto';
import { GetWorkspaceFoldersQueryDto } from './dto/get-workspace-folders.dto';
import { StorageNotificationService } from '../../externals/notifications/storage.notifications.service';
import { Client } from '../../common/decorators/client.decorator';
import { WorkspaceLogGlobalActionType } from './attributes/workspace-logs.attributes';
import { WorkspaceLogAction } from './decorators/workspace-log-action.decorator';
import { GetWorkspaceLogsDto } from './dto/get-workspace-logs';
import { IsSharedItem } from '../sharing/decorators/is-shared-item.decorator';
import { Requester } from '../auth/decorators/requester.decorator';
import { ResultFilesDto, FileDto } from '../file/dto/responses/file.dto';
import {
  FolderDto,
  ResultFoldersDto,
} from '../folder/dto/responses/folder.dto';
import { GetAvailableWorkspacesResponseDto } from './dto/reponse/workspace.dto';
import { WorkspaceCredentialsDto } from './dto/reponse/workspace-credentials.dto';

@ApiTags('Workspaces')
@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspaceUseCases: WorkspacesUsecases,
    private readonly storageNotificationService: StorageNotificationService,
  ) {}

  @Get('/')
  @ApiOperation({
    summary: 'Get available workspaces for the user',
  })
  @ApiOkResponse({
    description: 'Available workspaces and workspaceUser',
    type: GetAvailableWorkspacesResponseDto,
  })
  @ApiBearerAuth()
  async getAvailableWorkspaces(
    @UserDecorator() user: User,
  ): Promise<GetAvailableWorkspacesResponseDto> {
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
    @Client() clientId: string,
    @Body() acceptInvitationDto: AcceptWorkspaceInviteDto,
  ) {
    const { inviteId } = acceptInvitationDto;

    const workspaceUser = await this.workspaceUseCases.acceptWorkspaceInvite(
      user,
      inviteId,
    );

    const workspace = await this.workspaceUseCases.findById(
      workspaceUser.workspaceId,
    );

    this.storageNotificationService.workspaceJoined({
      payload: { workspaceId: workspace.id, workspaceName: workspace.name },
      user,
      clientId,
    });

    return workspaceUser;
  }

  @Get('/invitations/:inviteId/validate')
  @ApiOperation({
    summary: 'Validates if invitation is valid',
  })
  @ApiOkResponse({
    description: 'Workspace invitation is valid',
  })
  @Public()
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

  @Delete('/:workspaceId/teams/:teamId')
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

  @Get('/:workspaceId/files')
  @ApiOkResponse({ isArray: true, type: FileDto })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async getFiles(
    @UserDecorator() user: User,
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: string,
    @Query() query: GetWorkspaceFilesQueryDto,
  ): Promise<FileDto[]> {
    const { limit, offset, status, bucket, sort, order, updatedAt } = query;
    const files =
      await this.workspaceUseCases.getPersonalWorkspaceFilesInWorkspaceUpdatedAfter(
        user.uuid,
        workspaceId,
        new Date(updatedAt || 1),
        {
          limit,
          offset,
          sort,
          order,
          status: status !== 'ALL' ? status : undefined,
        },
        bucket,
      );

    return files.map((f) => {
      delete f.deleted;
      delete f.deletedAt;
      delete f.removed;
      delete f.removedAt;

      return f;
    });
  }

  @Get('/:workspaceId/folders')
  @ApiOkResponse({ isArray: true, type: FolderDto })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async getFolders(
    @UserDecorator() user: User,
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: string,
    @Query() query: GetWorkspaceFoldersQueryDto,
  ): Promise<FolderDto[]> {
    const { limit, offset, status, sort, order, updatedAt } = query;

    const folders =
      await this.workspaceUseCases.getPersonalWorkspaceFoldersInWorkspaceUpdatedAfter(
        user.uuid,
        workspaceId,
        new Date(updatedAt || 1),
        {
          limit,
          offset,
          sort,
          order,
          status: status !== 'ALL' ? status : undefined,
        },
      );

    return folders.map((f) => ({
      ...f,
      status: f.getFolderStatus(),
    }));
  }

  @Patch('/:workspaceId/teams/:teamId/manager')
  @ApiOperation({
    summary: 'Changes the manager of a team',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'teamId', type: String, required: true })
  @ApiOkResponse({
    description: 'Team manager changed',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.TEAM, WorkspaceRole.MANAGER)
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
    @UploadedFile() file: Express.MulterS3.File,
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
    type: WorkspaceCredentialsDto,
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async getWorkspaceUser(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
  ): Promise<WorkspaceCredentialsDto> {
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
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async getWorkspaceMembers(
    @Param('workspaceId') workspaceId: WorkspaceAttributes['id'],
    @UserDecorator() user: User,
    @Query('search') search?: string,
  ) {
    if (!workspaceId || !isUUID(workspaceId)) {
      throw new BadRequestException('Invalid workspace ID');
    }

    return this.workspaceUseCases.getWorkspaceMembers(workspaceId, search);
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
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async getWorkspaceTeams(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @UserDecorator() user: User,
  ) {
    return this.workspaceUseCases.getWorkspaceTeams(user, workspaceId);
  }

  @Get('/:workspaceId/usage/member')
  @ApiOperation({
    summary: 'User usage in drive',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiOkResponse({
    description: 'User usage in drive',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async calculateUserUsage(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @UserDecorator() user: User,
  ) {
    return this.workspaceUseCases.getUserUsageInWorkspace(user, workspaceId);
  }

  @Post('/:workspaceId/files')
  @ApiOperation({
    summary: 'Create File',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiOkResponse({
    description: 'Created File',
    type: FileDto,
  })
  @UseGuards(WorkspaceGuard, SharingPermissionsGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  @RequiredSharingPermissions(SharingActionName.UploadFile)
  async createFile(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @UserDecorator() user: User,
    @Client() clientId: string,
    @Body() createFileDto: CreateWorkspaceFileDto,
    @UserTier() tier,
  ): Promise<FileDto> {
    const file = await this.workspaceUseCases.createFile(
      user,
      workspaceId,
      createFileDto,
      tier,
    );

    this.storageNotificationService.fileCreated({
      payload: file,
      user,
      clientId,
    });

    return file;
  }

  @Post('/:workspaceId/shared/')
  @ApiOperation({
    summary: 'Share file or folder to workspace',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiOkResponse({
    description: 'Shared Item',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  @WorkspaceLogAction(WorkspaceLogGlobalActionType.Share)
  async shareItemWithMember(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @UserDecorator() user: User,
    @Body() shareItemWithTeam: ShareItemWithTeamDto,
  ) {
    return this.workspaceUseCases.shareItemWithTeam(
      user,
      workspaceId,
      shareItemWithTeam,
    );
  }

  @Get([':workspaceId/teams/:teamId/shared/files', ':workspaceId/shared/files'])
  @ApiOperation({
    summary: 'Get shared files in teams',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async getSharedFilesInWorkspace(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceTeamAttributes['id'],
    @UserDecorator() user: User,
    @Query('orderBy') orderBy: OrderBy,
    @Query() pagination: GetSharedItemsDto,
  ) {
    const order = orderBy
      ? [orderBy.split(':') as [string, string]]
      : undefined;

    return this.workspaceUseCases.getSharedFilesInWorkspace(user, workspaceId, {
      offset: pagination.page,
      limit: pagination.perPage,
      order,
    });
  }

  @Get([
    ':workspaceId/teams/:teamId/shared/folders',
    ':workspaceId/shared/folders',
  ])
  @ApiOperation({
    summary: 'Get shared folders in teams',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async getSharedFoldersInWorkspace(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceTeamAttributes['id'],
    @UserDecorator() user: User,
    @Query('orderBy') orderBy: OrderBy,
    @Query() pagination: GetSharedItemsDto,
  ) {
    const order = orderBy
      ? [orderBy.split(':') as [string, string]]
      : undefined;

    return this.workspaceUseCases.getSharedFoldersInWorkspace(
      user,
      workspaceId,
      {
        offset: pagination.page,
        limit: pagination.perPage,
        order,
      },
    );
  }

  @Get([
    ':workspaceId/teams/:teamId/shared/:sharedFolderId/folders',
    ':workspaceId/shared/:sharedFolderId/folders',
  ])
  @ApiOperation({
    summary: 'Get folders inside a shared folder',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async getFoldersInSharingFolder(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @UserDecorator() user: User,
    @Param('sharedFolderId', ValidateUUIDPipe) sharedFolderId: Folder['uuid'],
    @Query() queryDto: GetSharedItemsDto,
  ) {
    const { orderBy, token, page, perPage } = queryDto;

    const order = orderBy
      ? [orderBy.split(':') as [string, string]]
      : undefined;

    return this.workspaceUseCases.getItemsInSharedFolder(
      workspaceId,
      user,
      sharedFolderId,
      WorkspaceItemType.Folder,
      token,
      { page, perPage, order },
    );
  }

  @Get([
    ':workspaceId/teams/:teamId/shared/:sharedFolderId/files',
    ':workspaceId/shared/:sharedFolderId/files',
  ])
  @ApiOperation({
    summary: 'Get files inside a shared folder',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async getFilesInSharingFolder(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @UserDecorator() user: User,
    @Param('sharedFolderId', ValidateUUIDPipe) sharedFolderId: Folder['uuid'],
    @Query() queryDto: GetSharedItemsDto,
  ) {
    const { orderBy, token, page, perPage } = queryDto;

    const order = orderBy
      ? [orderBy.split(':') as [string, string]]
      : undefined;

    return this.workspaceUseCases.getItemsInSharedFolder(
      workspaceId,
      user,
      sharedFolderId,
      WorkspaceItemType.File,
      token,
      { page, perPage, order },
    );
  }

  @Get('/:workspaceId/shared/:itemType/:itemId/shared-with')
  @ApiOperation({
    summary: 'Get users and teams an item is shared with',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiParam({ name: 'itemType', type: String, required: true })
  @ApiParam({ name: 'itemId', type: String, required: true })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async getItemSharedWith(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @UserDecorator() user: User,
    @Param() sharedWithParams: GetSharedWithDto,
  ) {
    const { itemId, itemType } = sharedWithParams;

    return this.workspaceUseCases.getItemSharedWith(
      user,
      workspaceId,
      itemId,
      itemType,
    );
  }

  @Post('/:workspaceId/folders')
  @ApiOperation({
    summary: 'Create folder',
  })
  @ApiBearerAuth()
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiOkResponse({
    description: 'Created Folder',
    type: FolderDto,
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async createFolder(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @UserDecorator() user: User,
    @Client() clientId: string,
    @Body() createFolderDto: CreateWorkspaceFolderDto,
  ): Promise<FolderDto> {
    const folder = await this.workspaceUseCases.createFolder(
      user,
      workspaceId,
      createFolderDto,
    );

    const folderDto = { ...folder, status: FolderStatus.EXISTS };

    this.storageNotificationService.folderCreated({
      payload: folderDto,
      user,
      clientId,
    });

    return folderDto;
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
    @Query() pagination: BasicPaginationDto,
    @Query('type') type: WorkspaceItemType,
    @Query('sort') sort?: SortableFolderAttributes | SortableFileAttributes,
    @Query('order') order?: 'ASC' | 'DESC',
  ) {
    const { limit, offset } = pagination;

    return this.workspaceUseCases.getWorkspaceUserTrashedItems(
      user,
      workspaceId,
      type,
      limit,
      offset,
      sort && order ? [[sort, order]] : undefined,
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
  @WorkspaceLogAction(WorkspaceLogGlobalActionType.DeleteAll)
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
    type: ResultFoldersDto,
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async getFoldersInFolder(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: string,
    @Param('folderUuid', ValidateUUIDPipe)
    folderUuid: string,
    @UserDecorator() user: User,
    @Query() pagination: BasicPaginationDto,
    @Query('sort') sort?: SortableFolderAttributes,
    @Query('order') order?: 'ASC' | 'DESC',
  ): Promise<ResultFoldersDto> {
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
    type: ResultFilesDto,
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async getFilesInFolder(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @Param('folderUuid', ValidateUUIDPipe)
    folderUuid: FolderAttributes['uuid'],
    @UserDecorator() user: User,
    @Query() pagination: BasicPaginationDto,
    @Query('sort') sort?: SortableFileAttributes,
    @Query('order') order?: 'ASC' | 'DESC',
  ): Promise<ResultFilesDto> {
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
    @Client() clientId: string,
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
  ) {
    const workspace = await this.workspaceUseCases.findById(workspaceId);

    await this.workspaceUseCases.leaveWorkspace(workspaceId, user);

    this.storageNotificationService.workspaceLeft({
      payload: { workspaceId: workspace.id, workspaceName: workspace.name },
      user,
      clientId,
    });
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

  @Patch(':workspaceId/members/:memberId/activate')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Activate workspace user',
  })
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiParam({ name: 'memberId', type: String, required: true })
  @ApiOkResponse({
    description: 'User successfully activated',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.OWNER)
  async activateWorkspaceMember(
    @Param('memberId', ValidateUUIDPipe)
    memberId: WorkspaceTeamAttributes['id'],
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
  ) {
    return this.workspaceUseCases.activateWorkspaceUser(memberId, workspaceId);
  }

  @Get(':workspaceId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get workspace details',
  })
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiOkResponse({
    description: 'Workspace details',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async getWorkspaceDetails(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
  ) {
    return this.workspaceUseCases.getWorkspaceDetails(workspaceId);
  }

  @Delete(':workspaceId/members/:memberId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remove member from workspace',
  })
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiParam({ name: 'memberId', type: String, required: true })
  @ApiOkResponse({
    description: 'Member removed from workspace',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.OWNER)
  async removeWorkspaceMember(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @Param('memberId', ValidateUUIDPipe)
    memberId: WorkspaceTeamAttributes['id'],
    @Client() clientId: string,
  ) {
    const workspace = await this.workspaceUseCases.findById(workspaceId);

    const workspaceUser = await this.workspaceUseCases.findUserInWorkspace(
      memberId,
      workspaceId,
      true,
    );

    if (!workspaceUser) {
      throw new NotFoundException('User not found in workspace');
    }

    await this.workspaceUseCases.removeWorkspaceMember(workspaceId, memberId);

    this.storageNotificationService.workspaceLeft({
      payload: { workspaceId: workspace.id, workspaceName: workspace.name },
      user: workspaceUser.member,
      clientId,
    });
  }

  @Get(':workspaceId/fuzzy/:search')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Search by name inside workspace',
  })
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiParam({ name: 'search', type: String, required: true })
  @ApiOkResponse({
    description: 'Search results',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  async searchWorkspace(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @UserDecorator() user: User,
    @Param('search') search: string,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.workspaceUseCases.searchWorkspaceContent(
      user,
      workspaceId,
      search,
      offset,
    );
  }

  @Get(':workspaceId/access/logs')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Access Logs',
  })
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiOkResponse({
    description: 'Access Logs',
  })
  @UseGuards(WorkspaceGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.OWNER)
  async accessLogs(
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @UserDecorator() user: User,
    @Query() workspaceLogDto: GetWorkspaceLogsDto,
  ) {
    const {
      limit,
      offset,
      member,
      activity: logType,
      lastDays,
      summary,
      orderBy,
    } = workspaceLogDto;

    const order = orderBy
      ? [orderBy.split(':') as [string, string]]
      : undefined;

    return this.workspaceUseCases.accessLogs(
      workspaceId,
      { limit, offset },
      member,
      logType,
      lastDays,
      summary,
      order,
    );
  }

  @Get(':workspaceId/:itemType/:uuid/ancestors')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'See item ancestors',
  })
  @ApiParam({ name: 'workspaceId', type: String, required: true })
  @ApiParam({ name: 'itemType', type: String, required: true })
  @ApiParam({ name: 'uuid', type: String, required: true })
  @ApiOkResponse({
    description: 'Item ancestors details',
  })
  @GetDataFromRequest([
    {
      sourceKey: 'params',
      fieldName: 'uuid',
      newFieldName: 'itemUuid',
    },
    {
      sourceKey: 'params',
      fieldName: 'itemType',
    },
  ])
  @UseGuards(WorkspaceGuard, SharingPermissionsGuard)
  @WorkspaceRequiredAccess(AccessContext.WORKSPACE, WorkspaceRole.MEMBER)
  @RequiredSharingPermissions(SharingActionName.ViewDetails)
  async getWorkspaceItemAncestors(
    @Requester() user: User,
    @Param('workspaceId', ValidateUUIDPipe)
    workspaceId: WorkspaceAttributes['id'],
    @Param('itemType') itemType: WorkspaceItemType,
    @Param('uuid', ValidateUUIDPipe)
    itemUuid: Sharing['itemId'],
    @IsSharedItem() isSharedItem: boolean,
  ) {
    if (!isSharedItem) {
      const creator = await this.workspaceUseCases.isUserCreatorOfItem(
        user,
        itemUuid,
        itemType,
      );
      if (!creator) {
        throw new ForbiddenException('You cannot access this resource');
      }
    }

    return this.workspaceUseCases.getWorkspaceItemAncestors(
      workspaceId,
      itemType,
      itemUuid,
    );
  }
}
