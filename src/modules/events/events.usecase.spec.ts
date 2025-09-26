import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createMock } from '@golevelup/ts-jest';
import { EventsUseCases } from './events.usecase';
import { MailerService } from '../../externals/mailer/mailer.service';
import { IncompleteCheckoutDto } from './dto/incomplete-checkout.dto';
import { User } from '../user/user.domain';
import { newUser } from '../../../test/fixtures';

describe('EventsUseCases', () => {
  let usecases: EventsUseCases;
  let mailerService: MailerService;
  let configService: ConfigService;

  const mockUser = newUser({ attributes: { email: 'test@internxt.com' } });
  const mockIncompleteCheckoutDto: IncompleteCheckoutDto = {
    complete_checkout_url: 'https://drive.internxt.com/checkout/complete',
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [EventsUseCases],
    })
      .useMocker(createMock)
      .compile();

    usecases = moduleRef.get<EventsUseCases>(EventsUseCases);
    mailerService = moduleRef.get<MailerService>(MailerService);
    configService = moduleRef.get<ConfigService>(ConfigService);
  });

  it('When tests are started, then it should be defined', () => {
    expect(usecases).toBeDefined();
    expect(mailerService).toBeDefined();
    expect(configService).toBeDefined();
  });

  describe('handle incomplete checkout event', () => {
    it('When valid user and dto are provided, then should send email successfully', async () => {
      const mockSendIncompleteCheckoutEmail = jest
        .spyOn(mailerService, 'sendIncompleteCheckoutEmail')
        .mockResolvedValue(undefined);

      const result = await usecases.handleIncompleteCheckoutEvent(
        mockUser,
        mockIncompleteCheckoutDto,
      );

      expect(result).toEqual({ success: true });
      expect(mockSendIncompleteCheckoutEmail).toHaveBeenCalledWith(
        mockUser.email,
        mockIncompleteCheckoutDto.complete_checkout_url,
      );
    });

    it('When mailer service throws error, then should propagate the error', async () => {
      const mockError = new Error('SendGrid service unavailable');
      jest
        .spyOn(mailerService, 'sendIncompleteCheckoutEmail')
        .mockRejectedValue(mockError);

      await expect(
        usecases.handleIncompleteCheckoutEvent(
          mockUser,
          mockIncompleteCheckoutDto,
        ),
      ).rejects.toThrow('SendGrid service unavailable');
    });
  });
});
