import { Test, type TestingModule } from '@nestjs/testing';
import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { MailUseCases } from './mail.usecase';
import { MailService } from '../../externals/mail/mail.service';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { PaymentRequiredException } from '../feature-limit/exceptions/payment-required.exception';
import { newUser, newFeatureLimit } from '../../../test/fixtures';
import { LimitTypes, LimitLabels } from '../feature-limit/limits.enum';

describe('MailUseCases', () => {
  let mailUseCases: MailUseCases;
  let cryptoService: DeepMocked<CryptoService>;
  let mailService: DeepMocked<MailService>;
  let featureLimitService: DeepMocked<FeatureLimitService>;

  const dto = {
    address: 'john',
    domain: 'inxt.eu',
    displayName: 'John Doe',
    password: 'encrypted-password',
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [MailUseCases],
    })
      .useMocker(() => createMock())
      .compile();

    mailUseCases = moduleRef.get(MailUseCases);
    cryptoService = moduleRef.get(CryptoService);
    mailService = moduleRef.get(MailService);
    featureLimitService = moduleRef.get(FeatureLimitService);
  });

  describe('createMailAccount', () => {
    it('When mail access limit is disabled, then it should throw PaymentRequiredException', async () => {
      const user = newUser();
      const disabledLimit = newFeatureLimit({
        type: LimitTypes.Boolean,
        label: LimitLabels.MailAccess,
        value: 'false',
      });

      featureLimitService.getUserLimitByLabel.mockResolvedValueOnce(
        disabledLimit,
      );

      await expect(mailUseCases.createMailAccount(user, dto)).rejects.toThrow(
        PaymentRequiredException,
      );
    });

    it('When mail access limit is not found, then it should throw PaymentRequiredException', async () => {
      const user = newUser();

      featureLimitService.getUserLimitByLabel.mockResolvedValueOnce(null);

      await expect(mailUseCases.createMailAccount(user, dto)).rejects.toThrow(
        PaymentRequiredException,
      );
    });

    it('When password is incorrect, then it should throw UnauthorizedException', async () => {
      const user = newUser({ attributes: { password: 'correct-hash' } });
      const enabledLimit = newFeatureLimit({
        type: LimitTypes.Boolean,
        label: LimitLabels.MailAccess,
        value: 'true',
      });

      featureLimitService.getUserLimitByLabel.mockResolvedValueOnce(
        enabledLimit,
      );
      cryptoService.decryptText.mockReturnValueOnce('wrong-hash');

      await expect(mailUseCases.createMailAccount(user, dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('When all validations pass, then it should provision the mail account and return the full address', async () => {
      const user = newUser({
        attributes: { email: 'user@gmail.com', password: 'hashed' },
      });
      const enabledLimit = newFeatureLimit({
        type: LimitTypes.Boolean,
        label: LimitLabels.MailAccess,
        value: 'true',
      });

      featureLimitService.getUserLimitByLabel.mockResolvedValueOnce(
        enabledLimit,
      );
      cryptoService.decryptText.mockReturnValueOnce('hashed');
      mailService.createAccount.mockResolvedValueOnce({
        address: 'john@inxt.eu',
        domain: 'inxt.eu',
      });

      const result = await mailUseCases.createMailAccount(user, dto);

      expect(result).toEqual({ address: 'john@inxt.eu' });
      expect(mailService.createAccount).toHaveBeenCalledWith({
        userId: user.uuid,
        address: 'john@inxt.eu',
        domain: 'inxt.eu',
        displayName: 'John Doe',
      });
    });

    it('When mail service returns 409, then it should propagate ConflictException', async () => {
      const user = newUser({
        attributes: { email: 'user@gmail.com', password: 'hashed' },
      });
      const enabledLimit = newFeatureLimit({
        type: LimitTypes.Boolean,
        label: LimitLabels.MailAccess,
        value: 'true',
      });

      featureLimitService.getUserLimitByLabel.mockResolvedValueOnce(
        enabledLimit,
      );
      cryptoService.decryptText.mockReturnValueOnce('hashed');
      mailService.createAccount.mockRejectedValueOnce(
        new ConflictException('Mail account already exists'),
      );

      await expect(mailUseCases.createMailAccount(user, dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
