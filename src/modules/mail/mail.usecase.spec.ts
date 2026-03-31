import { Test, type TestingModule } from '@nestjs/testing';
import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { MailUseCases } from './mail.usecase';
import { MailService } from '../../externals/mail/mail.service';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { SequelizeUserRepository } from '../user/user.repository';
import { UserUseCases } from '../user/user.usecase';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { PaymentRequiredException } from '../feature-limit/exceptions/payment-required.exception';
import { newUser, newFeatureLimit } from '../../../test/fixtures';
import { LimitTypes, LimitLabels } from '../feature-limit/limits.enum';

describe('MailUseCases', () => {
  let mailUseCases: MailUseCases;
  let cryptoService: DeepMocked<CryptoService>;
  let mailService: DeepMocked<MailService>;
  let userRepository: DeepMocked<SequelizeUserRepository>;
  let userUseCases: DeepMocked<UserUseCases>;
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
    userRepository = moduleRef.get(SequelizeUserRepository);
    userUseCases = moduleRef.get(UserUseCases);
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

    it('When user email is on a blocked domain, then it should throw BadRequestException', async () => {
      const user = newUser({
        attributes: { email: 'user@inxt.eu', password: 'hashed' },
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

      await expect(mailUseCases.createMailAccount(user, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('When all validations pass, then it should create account and return tokens', async () => {
      const user = newUser({
        attributes: { email: 'user@gmail.com', password: 'hashed' },
      });
      const updatedUser = newUser({
        attributes: {
          uuid: user.uuid,
          email: 'john@inxt.eu',
          recoveryEmail: 'user@gmail.com',
        },
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
      userRepository.updateByUuid.mockResolvedValueOnce(undefined);
      userRepository.findByUuid.mockResolvedValueOnce(updatedUser);
      userUseCases.getAuthTokens.mockResolvedValueOnce({
        token: 'new-token',
        newToken: 'new-new-token',
      });

      const result = await mailUseCases.createMailAccount(user, dto);

      expect(result).toEqual({
        token: 'new-token',
        newToken: 'new-new-token',
        address: 'john@inxt.eu',
      });
      expect(mailService.createAccount).toHaveBeenCalledWith({
        userId: user.uuid,
        address: 'john@inxt.eu',
        domain: 'inxt.eu',
        displayName: 'John Doe',
      });
      expect(userRepository.updateByUuid).toHaveBeenCalledWith(user.uuid, {
        email: 'john@inxt.eu',
        recoveryEmail: 'user@gmail.com',
      });
    });

    it('When user update fails, then it should rollback recovery email', async () => {
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
      userRepository.updateByUuid
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce(undefined);

      await expect(mailUseCases.createMailAccount(user, dto)).rejects.toThrow(
        'DB error',
      );

      expect(userRepository.updateByUuid).toHaveBeenNthCalledWith(
        2,
        user.uuid,
        { email: 'user@gmail.com', recoveryEmail: null },
      );
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
