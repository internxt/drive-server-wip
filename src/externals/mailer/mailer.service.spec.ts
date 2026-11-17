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
    'mailer.templates.outdatedClient': 'outdated-client-template-id',
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

    it('When the plan name is unknown, then the email is sent without it', async () => {
      await mailerService.sendAccountSetupEmail('buyer@internxt.com', {
        setupUrl: 'https://drive.internxt.com/complete-account/token',
      });

      expect(sendgrid.send).toHaveBeenCalledWith(
        expect.objectContaining({
          personalizations: [
            {
              to: [{ email: 'buyer@internxt.com' }],
              dynamic_template_data: {
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

  describe('Outdated client email', () => {
    it('When the outdated client email is sent, then it uses the outdated client template with the client details', async () => {
      await mailerService.sendOutdatedClientEmail('user@example.com', {
        client: 'drive-desktop-windows',
        version: '2.3.0',
        recommendedVersion: '2.8.1',
        sunsetAt: '2026-12-01T00:00:00.000Z',
      });

      expect(sendgrid.send).toHaveBeenCalledWith(
        expect.objectContaining({
          template_id: 'outdated-client-template-id',
          personalizations: [
            {
              to: [{ email: 'user@example.com' }],
              dynamic_template_data: {
                client: 'drive-desktop-windows',
                version: '2.3.0',
                recommended_version: '2.8.1',
                sunset_at: '2026-12-01T00:00:00.000Z',
              },
            },
          ],
        }),
      );
    });
  });
});
