import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EventsUseCases } from './events.usecase';
import { IncompleteCheckoutDto } from './dto/incomplete-checkout.dto';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { User } from '../user/user.domain';

@ApiTags('Events')
@Controller('events')
@ApiBearerAuth()
export class EventsController {
  constructor(private readonly eventsUseCases: EventsUseCases) {}

  @Post('/payments/incomplete-checkout')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Handle incomplete checkout event',
    description: 'Sends notification email when user abandons checkout process',
  })
  @ApiResponse({
    status: 200,
    description: 'Incomplete checkout email sent successfully',
  })
  async handleIncompleteCheckout(
    @UserDecorator() user: User,
    @Body() dto: IncompleteCheckoutDto,
  ) {
    return this.eventsUseCases.handleIncompleteCheckoutEvent(user, dto);
  }
}
