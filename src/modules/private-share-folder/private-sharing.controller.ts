import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PrivateSharingUseCase } from './private-sharing.usecase';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { Folder } from '../folder/folder.domain';
import { User } from '../user/user.domain';
import { OrderBy } from 'src/common/order.type';
import { Pagination } from 'src/lib/pagination';
import { GrantPrivilegesDto } from './dto/grant-privilages.dto';
import { UpdatePrivilegesDto } from './dto/update-privilages.dto';

@ApiTags('Private Sharing')
@Controller('private-sharing')
export class PrivateSharingController {
  constructor(private readonly privateSharingUseCase: PrivateSharingUseCase) {}

  @Post('grant-privileges')
  @ApiOperation({
    summary: 'Grant privileges to a user on a folder',
  })
  @ApiOkResponse({ description: 'Grant privileges to a user on a folder' })
  @ApiBearerAuth()
  async grantPrivileges(
    @UserDecorator() user: User,
    @Body() dto: GrantPrivilegesDto,
  ): Promise<Record<'message', string>> {
    try {
      await this.privateSharingUseCase.grantPrivileges(
        user,
        dto.userUuid,
        dto.privateFolderId,
        dto.roleId,
      );

      return {
        message: 'Privileges granted',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Put('update-role/:privateFolderRoleId')
  @ApiOperation({
    summary: 'Update role of a user on a folder',
  })
  @ApiOkResponse({ description: 'Update role of a user on a folder' })
  @ApiBearerAuth()
  async updateRole(
    @Param('privateFolderRoleId') privateFolderRoleId: string,
    @UserDecorator() user: User,
    @Body() dto: UpdatePrivilegesDto,
  ): Promise<Record<'message', string>> {
    try {
      await this.privateSharingUseCase.updateRole(
        user,
        privateFolderRoleId,
        dto.roleId,
      );

      return {
        message: 'Role updated',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('receive/folders')
  @ApiOperation({
    summary: 'Get all folders shared with a user',
  })
  @ApiQuery({
    description: 'Number of page to take by ( default 0 )',
    name: 'page',
    required: false,
    type: Number,
  })
  @ApiQuery({
    description: 'Number of items per page ( default 50 )',
    name: 'perPage',
    required: false,
    type: Number,
  })
  @ApiQuery({
    description: 'Order by',
    name: 'orderBy',
    required: false,
    type: String,
  })
  @ApiOkResponse({ description: 'Get all folders shared with a user' })
  @ApiBearerAuth()
  async getReceivedFolders(
    @UserDecorator() user: User,
    @Query('page') page = 0,
    @Query('perPage') perPage = 50,
    @Query('orderBy') orderBy: OrderBy,
  ): Promise<Record<'folders', Folder[]>> {
    const { offset, limit } = Pagination.calculatePagination(page, perPage);

    const order = orderBy
      ? [orderBy.split(':') as [string, string]]
      : undefined;

    return {
      folders: await this.privateSharingUseCase.getReceivedFolders(
        user,
        offset,
        limit,
        order,
      ),
    };
  }

  @Get('sent/folders')
  @ApiOperation({
    summary: 'Get all folders shared by a user',
  })
  @ApiQuery({
    description: 'Number of page to take by ( default 0 )',
    name: 'page',
    required: false,
    type: Number,
  })
  @ApiQuery({
    description: 'Number of items per page ( default 50 )',
    name: 'perPage',
    required: false,
    type: Number,
  })
  @ApiQuery({
    description: 'Order by',
    name: 'orderBy',
    required: false,
    type: String,
  })
  @ApiOkResponse({ description: 'Get all folders shared by a user' })
  @ApiBearerAuth()
  async getSentFolders(
    @UserDecorator() user: User,
    @Query('page') page = 0,
    @Query('perPage') perPage = 50,
    @Query('orderBy') orderBy: OrderBy,
  ): Promise<Record<'folders', Folder[]>> {
    const { offset, limit } = Pagination.calculatePagination(page, perPage);

    const order = orderBy
      ? [orderBy.split(':') as [string, string]]
      : undefined;

    return {
      folders: await this.privateSharingUseCase.getSentFolders(
        user,
        offset,
        limit,
        order,
      ),
    };
  }
}
