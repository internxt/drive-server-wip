import {
  Body,
  Headers,
  Controller,
  Post,
  HttpCode,
  Logger,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MoveItemsToTrashDto } from './dto/move-items-to-trash.dto';
import { TrashService } from './trash.service';
import { User } from '../auth/user.decorator';

@ApiTags('Trash')
@Controller('storage/trash')
@UseGuards(AuthGuard('jwt'))
export class TrashController {
  constructor(
    private trashService: TrashService,
    private readonly logger: Logger,
  ) {}

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
  ) {
    return await this.trashService.addItems(user.id, moveItemsDto);
  }
}
