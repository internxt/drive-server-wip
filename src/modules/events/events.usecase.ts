import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '../../externals/mailer/mailer.service';
import { IncompleteCheckoutDto } from './dto/incomplete-checkout.dto';
import { User } from '../user/user.domain';

@Injectable()
export class EventsUseCases {
  constructor(
    private readonly mailerService: MailerService,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  async handleIncompleteCheckoutEvent(
    user: User,
    dto: IncompleteCheckoutDto,
  ): Promise<{ success: boolean }> {
    try {
      await this.mailerService.sendIncompleteCheckoutEmail(
        user.email,
        dto.complete_checkout_url,
      );
      return { success: true };
    } catch (error) {
      new Logger('[EVENTS/INCOMPLETE_CHECKOUT]').error(
        `Failed to send incomplete checkout email to ${user.email}: ${error.message}`,
      );
      throw error;
    }
  }
}
