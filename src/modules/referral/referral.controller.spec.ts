import { type Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type DeepMocked, createMock } from '@golevelup/ts-jest';
import { newUser } from '../../../test/fixtures';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { Limit } from '../feature-limit/domain/limit.domain';
import { LimitLabels, LimitTypes } from '../feature-limit/limits.enum';
import {
  PaymentRequiredErrorCode,
  PaymentRequiredException,
} from '../feature-limit/exceptions/payment-required.exception';

describe('ReferralController', () => {
  let controller: ReferralController;
  let referralService: DeepMocked<ReferralService>;
  let featureLimitService: DeepMocked<FeatureLimitService>;

  const user = newUser();

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReferralController],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    controller = moduleRef.get(ReferralController);
    referralService = moduleRef.get(ReferralService);
    featureLimitService = moduleRef.get(FeatureLimitService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /enabled', () => {
    it('When referral is enabled, then it returns enabled true', async () => {
      const limit = Limit.build({
        id: 'limit-id',
        label: LimitLabels.ReferralAccess,
        type: LimitTypes.Boolean,
        value: 'true',
      });
      featureLimitService.getUserLimitByLabel.mockResolvedValue(limit);

      const result = await controller.isEnabled(user);

      expect(result).toEqual({ isEnabled: true });
      expect(featureLimitService.getUserLimitByLabel).toHaveBeenCalledWith(
        LimitLabels.ReferralAccess,
        user,
      );
    });

    it('When referral is disabled, then it returns enabled false', async () => {
      const limit = Limit.build({
        id: 'limit-id',
        label: LimitLabels.ReferralAccess,
        type: LimitTypes.Boolean,
        value: 'false',
      });
      featureLimitService.getUserLimitByLabel.mockResolvedValue(limit);

      const result = await controller.isEnabled(user);

      expect(result).toEqual({ isEnabled: false });
    });

    it('When no limit is found, then it returns enabled false', async () => {
      featureLimitService.getUserLimitByLabel.mockResolvedValue(null);

      const result = await controller.isEnabled(user);

      expect(result).toEqual({ isEnabled: false });
    });
  });

  describe('POST /token', () => {
    it('When called, then it returns the generated token', async () => {
      referralService.generateToken.mockReturnValue('jwt-token');

      const result = await controller.generateToken(user);

      expect(result).toEqual({ token: 'jwt-token' });
      expect(referralService.generateToken).toHaveBeenCalledWith(
        user.uuid,
        user.createdAt,
      );
    });

    it('When referral is not available for the user plan, then it fails because the feature is not in the plan', async () => {
      const limit = Limit.build({
        id: 'limit-id',
        label: LimitLabels.ReferralAccess,
        type: LimitTypes.Boolean,
        value: 'false',
      });
      featureLimitService.getUserLimitByLabel.mockResolvedValue(limit);

      const result = controller.generateToken(user);

      await expect(result).rejects.toThrow(PaymentRequiredException);
      await expect(result).rejects.toMatchObject({
        response: { errorCode: PaymentRequiredErrorCode.FeatureNotInPlan },
      });
      expect(referralService.generateToken).not.toHaveBeenCalled();
    });
  });
});
