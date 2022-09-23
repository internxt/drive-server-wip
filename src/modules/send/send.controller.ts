import {
  Controller,
  HttpCode,
  Post,
  Body,
  Get,
  Param,
  HttpStatus,
  Headers,
} from '@nestjs/common';
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
    const {
      items,
      code,
      receivers,
      sender,
      title,
      subject,
      plainCode,
      encryptedPassword,
    } = content;

    const sendLink = await this.sendUseCases.createSendLinks(
      user,
      items,
      code,
      receivers,
      sender,
      title,
      subject,
      plainCode,
      encryptedPassword,
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
      protected: sendLink.isProtected(),
    };
  }

  @Get('/:linkId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'get Send Link by id and return files',
  })
  @ApiOkResponse({ description: 'Get all shares in a list' })
  @Public()
  async getSendLink(
    @Param('linkId') linkId: string,
    @Headers('x-send-password') password: string | null,
  ) {
    const sendLink = await this.sendUseCases.getById(linkId);

    if (sendLink.isProtected()) {
      this.sendUseCases.unlockLink(sendLink, password);
    }

    return {
      id: sendLink.id,
      title: sendLink.title,
      subject: sendLink.subject,
      code: sendLink.code,
      views: sendLink.views,
      userId: sendLink.user ? sendLink.user.id : null,
      items: sendLink.items,
      createdAt: sendLink.createdAt,
      updatedAt: sendLink.updatedAt,
      expirationAt: sendLink.expirationAt,
      size: sendLink.size,
      protected: sendLink.isProtected(),
    };
  }

  async getUserWhenPublic(user) {
    if (user) {
      user = await this.userUseCases.getUserByUsername(user.username);
    }
    return user;
  }
}
