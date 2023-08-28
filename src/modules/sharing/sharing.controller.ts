import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  BadRequestException,
} from '@nestjs/common';
import { SharingService } from './sharing.service';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { User } from '../user/user.domain';
import { CreateInviteDto } from './dto/create-invite.dto';
import { Sharing, SharingInvite, SharingRole } from './sharing.domain';
import { UpdateSharingRoleDto } from './dto/update-sharing-role.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';

@Controller('sharings')
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  @Get('/:itemType/:itemId/invites')
  getInvites(
    @UserDecorator() user: User,
    @Param('itemType') itemType: string,
    @Param('itemId') itemId: string,
  ) {
    if (itemType !== 'file' && itemType !== 'folder') {
      throw new BadRequestException('Invalid item type');
    }
    return this.sharingService.getInvites(user, itemType, itemId);
  }

  @Post('/invites/send')
  createInvite(
    @UserDecorator() user: User,
    @Body() createInviteDto: CreateInviteDto,
  ) {
    return this.sharingService.createInvite(user, createInviteDto);
  }

  @Post('/invites/:id/accept')
  async acceptInvite(
    @UserDecorator() user,
    @Body() acceptInviteDto: AcceptInviteDto,
  ) {
    await this.sharingService.acceptInvite(user, acceptInviteDto);
  }

  @Delete('/invites/:id')
  async removeInvite(
    @UserDecorator() user,
    @Param('id') id: SharingInvite['id'],
  ) {
    await this.sharingService.removeInvite(user, id);
  }

  @Get('/:itemType/:itemId/files')
  getFilesFromSharing(@Param('itemType') itemType: string) {}

  @Get('/:itemType/:itemId/files')
  getFoldersFromSharing(@Param('itemType') itemType: string) {}

  @Delete('/:id')
  removeSharing(@UserDecorator() user: User, @Param('id') id: string) {
    return this.sharingService.removeSharing(user, id);
  }

  /**
   * PERMISSIONS
   */
  @Get('/roles')
  getRoles() {
    return this.sharingService.getRoles();
  }

  @Put('/:id/roles/:sharingRoleId')
  updateSharingRole(
    @UserDecorator() user: User,
    @Param('id') sharingRoleId: SharingRole['id'],
    @Body() dto: UpdateSharingRoleDto,
  ) {
    return this.sharingService.updateSharingRole(user, sharingRoleId, dto);
  }

  @Delete('/:sharingId/roles/:sharingRoleId')
  removeSharingRole(
    @UserDecorator() user: User,
    @Param('sharingId') sharingId: Sharing['id'],
    @Param('sharingRoleId') sharingRoleId: SharingRole['id'],
  ) {
    return this.sharingService.removeSharingRole(user, sharingRoleId);
  }
}
