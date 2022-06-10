import {
  Body,
  Controller,
  Post,
  HttpCode,
  Logger,
  UseGuards,
  Get,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MoveItemsToTrashDto } from './dto/controllers/move-items-to-trash.dto';
// import { TrashService } from './trash.service';
import { User } from '../auth/decorators/user.decorator';
import { Client } from '../auth/decorators/client.decorator';
import { FileUseCases } from '../file/file.usecase';
import { FolderService } from '../folder/folder.usecase';
import { UserService } from '../user/user.usecase';
import { ItemsToTrashEvent } from 'src/externals/notifications/events/items-to-trash.event';
import { NotificationService } from 'src/externals/notifications/notification.service';

@ApiTags('Trash')
@Controller('storage/trash')
@UseGuards(AuthGuard('jwt'))
export class TrashController {
  constructor(
    private fileUseCases: FileUseCases,
    private folderService: FolderService,
    private userService: UserService,
    private notificationService: NotificationService,
    private readonly logger: Logger,
  ) {}

  @Get('/')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get trash content',
  })
  @ApiOkResponse({ description: 'Get all folders and files in trash' })
  async getTrash(@User() user: any) {
    const folderId = user.rootFolderId;
    const [currentFolder, childrenFolders, files] = await Promise.all([
      this.folderService.getFolder(folderId),
      this.folderService.getChildrenFoldersToUser(folderId, user.id, true),
      this.fileUseCases.getByFolderAndUser(folderId, user.id, true),
    ]);
    return {
      ...currentFolder,
      children: childrenFolders,
      files,
    };
  }

  @Post('add')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Add items of files and folders to trash',
  })
  @ApiOkResponse({ description: 'All items moved to trash' })
  @ApiBadRequestResponse({ description: 'Any item id is invalid' })
  async moveItemsToTrash(
    @Body() moveItemsDto: MoveItemsToTrashDto,
    @User() user: any,
    @Client() clientId: string,
  ) {
    const fileIds: string[] = [];
    const folderIds: number[] = [];
    for (const item of moveItemsDto.items) {
      if (item.type === 'file') {
        fileIds.push(item.id);
      } else if (item.type === 'folder') {
        folderIds.push(parseInt(item.id));
      } else {
        throw new BadRequestException(`type ${item.type} invalid`);
      }
    }
    await Promise.all([
      this.fileUseCases.moveFilesToTrash(fileIds, user.id),
      this.folderService.moveFoldersToTrash(folderIds),
    ]);

    const workspaceMembers =
      await this.userService.getWorkspaceMembersByBrigeUser(user.bridgeUser);

    workspaceMembers.forEach(({ email }: { email: string }) => {
      const itemsToTrashEvent = new ItemsToTrashEvent(
        moveItemsDto.items,
        email,
        clientId,
      );
      this.notificationService.add(itemsToTrashEvent);
    });
    return;
  }
}
