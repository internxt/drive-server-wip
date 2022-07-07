import {
  Controller,
  HttpCode,
  Post,
  Body,
  Get,
  Param,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { UserUseCases } from '../user/user.usecase';
import { User } from '../user/user.domain';
import { SendUseCases } from './send.usecase';
import { Public } from '../auth/decorators/public.decorator';
import { CreateSendLinkDto } from './dto/create-send-link.dto';
import { send } from 'process';

@ApiTags('Sends')
@Controller('links')
export class SendController {
  constructor(
    private sendUseCases: SendUseCases,
    private userUseCases: UserUseCases,
  ) {}

  @Post('/')
  @HttpCode(HttpStatus.CREATED)
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
      views: sendLink.views,
      userId: user ? user.id : null,
      items: sendLink.items,
      createdAt: sendLink.createdAt,
      updatedAt: sendLink.updatedAt,
      expirationAt: sendLink.expirationAt,
    };
  }

  @Get('/:linkId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'get Send Link by id and return files',
  })
  @ApiOkResponse({ description: 'Get all shares in a list' })
  @Public()
  async getSendLink(@Param('linkId') linkId: string) {
    const sendLink = await this.sendUseCases.getById(linkId);

    return {
      id: sendLink.id,
      title: sendLink.title,
      subject: sendLink.subject,
      code: sendLink.code,
      views: sendLink.views,
      userId: sendLink.user ? sendLink.user.id : null,
      items: sendLink.items.map((item) => item.toJSON()),
      createdAt: sendLink.createdAt,
      updatedAt: sendLink.updatedAt,
      expirationAt: sendLink.expirationAt,
      size: sendLink.size,
    };
  }

  async getUserWhenPublic(user) {
    if (user) {
      user = await this.userUseCases.getUserByUsername(user.username);
    }
    return user;
  }
}
