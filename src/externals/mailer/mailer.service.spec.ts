import { Test, type TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import sendgrid from '@sendgrid/mail';
import { MailerService } from './mailer.service';

jest.mock('@sendgrid/mail', () => ({
  __esModule: true,
  default: { setApiKey: jest.fn(), send: jest.fn() },
}));

describe('MailerService', () => {
  let mailerService: MailerService;

  const config: Record<string, unknown> = {
    'mailer.apiKey': 'sendgrid-api-key',
    'mailer.from': 'hello@internxt.com',
    'mailer.name': 'Internxt',
    'mailer.sandbox': false,
    'mailer.templates.accountSetup': 'account-setup-template-id',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [MailerService],
    })
      .useMocker((token) => {
        if (token === ConfigService) {
          return createMock<ConfigService>({
            get: jest.fn((key: string) => config[key]),
          });
        }
        return createMock();
      })
      .compile();

    mailerService = module.get(MailerService);
  });

  describe('Account setup email', () => {
    it('When the account setup email is sent, then it uses the account setup template with the plan name and the setup link', async () => {
      await mailerService.sendAccountSetupEmail('buyer@internxt.com', {
        planName: 'Premium 2TB',
        setupUrl: 'https://drive.internxt.com/complete-account/token',
      });

      expect(sendgrid.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'buyer@internxt.com',
          from: { email: 'hello@internxt.com', name: 'Internxt' },
          template_id: 'account-setup-template-id',
          personalizations: [
            {
              to: [{ email: 'buyer@internxt.com' }],
              dynamic_template_data: {
                plan_name: 'Premium 2TB',
                setup_url: 'https://drive.internxt.com/complete-account/token',
              },
            },
          ],
        }),
      );
    });

    it('When the email provider fails, then the error reaches the caller', async () => {
      const providerError = new Error('SendGrid is down');
      jest.mocked(sendgrid.send).mockRejectedValueOnce(providerError);

      await expect(
        mailerService.sendAccountSetupEmail('buyer@internxt.com', {
          planName: 'Premium 2TB',
          setupUrl: 'https://drive.internxt.com/complete-account/token',
        }),
      ).rejects.toThrow(providerError);
    });
  });
});
