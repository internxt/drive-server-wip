import {
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { User } from '../user/user.domain';
import { FavoriteUseCases } from './favorite.usecase';
import { Favorite, FavoriteItemType } from './favorite.domain';
import { FileUseCases } from '../file/file.usecase';
import { FolderUseCases } from '../folder/folder.usecase';
import { FileDto } from '../file/dto/responses/file.dto';
import { FolderDto } from '../folder/dto/responses/folder.dto';
import { GetFavoritesDto } from './dto/get-favorites.dto';
import { ValidateUUIDPipe } from '../../common/pipes/validate-uuid.pipe';

@ApiTags('Favorite')
@Controller('favorites')
export class FavoriteController {
  constructor(
    private readonly favoriteUseCases: FavoriteUseCases,
    private readonly fileUseCases: FileUseCases,
    private readonly folderUseCases: FolderUseCases,
  ) {}

  @Get('/')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Gets favorite items',
    description:
      'Returns the favorite files or folders of the user, depending on the `type` query param.',
  })
  @ApiExtraModels(FileDto, FolderDto)
  @ApiOkResponse({
    description: 'Favorite files or folders, depending on `type`',
    schema: {
      type: 'array',
      items: {
        oneOf: [
          { $ref: getSchemaPath(FileDto) },
          { $ref: getSchemaPath(FolderDto) },
        ],
      },
    },
  })
  async getFavorites(
    @UserDecorator() user: User,
    @Query() query: GetFavoritesDto,
  ): Promise<FileDto[] | FolderDto[]> {
    const { type, limit, offset, sort, order } = query;

    if (type === FavoriteItemType.File) {
      return this.fileUseCases.getFavoriteFiles(user, {
        limit,
        offset,
        sort: sort && order && [[sort, order]],
      });
    }

    const folders = await this.folderUseCases.getFavoriteFolders(user, {
      limit,
      offset,
      sort: sort && order && [[sort, order]],
    });

    return folders.map((f) => {
      if (!f.plainName) {
        f.plainName = this.folderUseCases.decryptFolderName(f).plainName;
      }

      return { ...f, status: f.getFolderStatus() };
    });
  }

  @Put('/:itemType/:itemId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mark an item as favorite',
  })
  @ApiParam({
    name: 'itemType',
    description: 'file | folder',
    type: String,
  })
  @ApiParam({
    name: 'itemId',
    description: 'UUID of the item to mark as favorite',
    type: String,
  })
  @ApiOkResponse({ description: 'Item marked as favorite' })
  async markItemAsFavorite(
    @UserDecorator() user: User,
    @Param('itemType', new ParseEnumPipe(FavoriteItemType))
    itemType: FavoriteItemType,
    @Param('itemId', ValidateUUIDPipe) itemId: Favorite['itemId'],
  ): Promise<{ favorited: true }> {
    await this.favoriteUseCases.markAsFavorite(user, itemId, itemType);

    return { favorited: true };
  }

  @Delete('/:itemType/:itemId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Unmark an item as favorite',
  })
  @ApiParam({
    name: 'itemType',
    description: 'file | folder',
    type: String,
  })
  @ApiParam({
    name: 'itemId',
    description: 'UUID of the item to unmark as favorite',
    type: String,
  })
  @ApiOkResponse({ description: 'Item unmarked as favorite' })
  async unmarkItemAsFavorite(
    @UserDecorator() user: User,
    @Param('itemType', new ParseEnumPipe(FavoriteItemType))
    itemType: FavoriteItemType,
    @Param('itemId', ValidateUUIDPipe) itemId: Favorite['itemId'],
  ): Promise<{ favorited: false }> {
    await this.favoriteUseCases.unmarkAsFavorite(user, itemId, itemType);

    return { favorited: false };
  }
}
