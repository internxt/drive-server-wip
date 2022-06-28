import { Controller, HttpCode, Post, Body } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { UserUseCases } from '../user/user.usecase';
import { User } from '../user/user.domain';
import { SendUseCases } from './send.usecase';
import { Public } from '../auth/decorators/public.decorator';
import { CreateSendLinkDto } from './dto/create-send-link.dto';

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
  async createLinks(
    @UserDecorator() user: User | null,
    @Body() content: CreateSendLinkDto,
  ) {
    user = await this.getUserWhenPublic(user);
    const { items, code, receivers, sender, title, subject } = content;
    const sendLink = await this.sendUseCases.createSendLinks(
      user,
      items,
      code,
      receivers,
      sender,
      title,
      subject,
    );
    return {
      id: sendLink.id,
      title: sendLink.title,
      subject: sendLink.subject,
      code: sendLink.code,
      sender: sendLink.sender,
      receivers: sendLink.receivers,
      views: sendLink.views,
      userId: user ? user.id : null,
      items: sendLink.items,
      createdAt: sendLink.createdAt,
      updatedAt: sendLink.updatedAt,
      expirationAt: sendLink.expirationAt,
    };
  }

  async getUserWhenPublic(user) {
    if (user) {
      user = await this.userUseCases.getUserByUsername(user.username);
    }
    return user;
  }
}
