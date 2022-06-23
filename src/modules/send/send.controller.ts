import { Controller, HttpCode, Get, Query, Post, Body } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { FileUseCases } from '../file/file.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { UserUseCases } from '../user/user.usecase';
import { Public } from '../auth/decorators/public.decorator';
import { User } from '../user/user.domain';
import { SendUseCases } from './send.usecase';

@ApiTags('Sends')
@Controller('links')
export class SendController {
  constructor(
    private sendUseCases: SendUseCases,
    private fileUseCases: FileUseCases,
    private folderUseCases: FolderUseCases,
    private userUseCases: UserUseCases,
  ) {}

  @Post('/')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Create send link',
  })
  @ApiOkResponse({ description: 'Get all shares in a list' })
  async createLinks(@UserDecorator() user: User, @Body() content: any) {
    const { items, code, receiver } = content;
    const sendLink = await this.sendUseCases.createSendLinks(
      user,
      items,
      code,
      receiver,
    );
    return {
      id: sendLink.id,
      code: sendLink.code,
      receiver: sendLink.receiver,
      views: sendLink.views,
      userId: user.id,
      items: sendLink.items,
      createdAt: sendLink.createdAt,
      updatedAt: sendLink.updatedAt,
    };
  }

  async getUserWhenPublic(user) {
    if (user) {
      user = await this.userUseCases.getUserByUsername(user.username);
    }
    return user;
  }
}
