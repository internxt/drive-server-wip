import { Controller, HttpCode, Post, Body } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { UserUseCases } from '../user/user.usecase';
import { User } from '../user/user.domain';
import { SendUseCases } from './send.usecase';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Sends')
@Controller('links')
export class SendController {
  constructor(
    private sendUseCases: SendUseCases,
    private userUseCases: UserUseCases,
  ) {}

  @Post('/')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Create send link',
  })
  @ApiOkResponse({ description: 'Get all shares in a list' })
  @Public()
  async createLinks(@UserDecorator() user: User | null, @Body() content: any) {
    user = await this.getUserWhenPublic(user);
    const { items, code, receiver, sender } = content;
    const sendLink = await this.sendUseCases.createSendLinks(
      user,
      items,
      code,
      receiver,
      sender,
    );
    return {
      id: sendLink.id,
      code: sendLink.code,
      sender: sendLink.sender,
      receiver: sendLink.receiver,
      views: sendLink.views,
      userId: user ? user.id : null,
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
