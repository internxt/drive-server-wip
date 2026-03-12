import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User as UserDecorator } from '../auth/decorators/user.decorator';
import { type User } from '../user/user.domain';
import { CelloService } from './cello.service';
import { TrackPurchaseDto } from './dto/track-purchase.dto';

@ApiTags('Cello')
@Controller('cello')
export class CelloController {
  constructor(private readonly celloService: CelloService) {}

  @Post('/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate Cello referral token' })
  @ApiOkResponse({ description: 'Cello JWT token generated successfully' })
  async generateToken(@UserDecorator() user: User) {
    const token = this.celloService.generateToken(user.uuid);
    return { token };
  }

  @Post('/track-purchase')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Track a referral purchase event' })
  @ApiOkResponse({ description: 'Purchase event tracked successfully' })
  async trackPurchase(
    @UserDecorator() user: User,
    @Body() body: TrackPurchaseDto,
  ) {
    await this.celloService.trackPurchaseEvent({
      ucc: body.ucc,
      userId: user.uuid,
      email: user.email,
      name: `${user.name} ${user.lastname}`.trim(),
      price: body.price,
      currency: body.currency,
      invoiceId: body.invoiceId,
      interval: body.interval,
      productKey: body.productKey,
      subscriptionId: body.subscriptionId,
    });
  }
}
