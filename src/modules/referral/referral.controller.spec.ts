import { type Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type DeepMocked, createMock } from '@golevelup/ts-jest';
import { newUser } from '../../../test/fixtures';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';

describe('ReferralController', () => {
  let controller: ReferralController;
  let referralService: DeepMocked<ReferralService>;

  const user = newUser();
  const purchaseBody = {
    ucc: 'referral-code',
    price: 49.99,
    currency: 'EUR',
    invoiceId: 'inv-123',
    interval: 'month',
    productKey: 'plan-premium',
    subscriptionId: 'sub-456',
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReferralController],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    controller = moduleRef.get(ReferralController);
    referralService = moduleRef.get(ReferralService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /token', () => {
    it('When called, then it returns the generated token', async () => {
      referralService.generateToken.mockReturnValue('jwt-token');

      const result = await controller.generateToken(user);

      expect(result).toEqual({ token: 'jwt-token' });
      expect(referralService.generateToken).toHaveBeenCalledWith(user.uuid);
    });
  });

  describe('POST /track-purchase', () => {
    it('When called, then it delegates to the service with mapped params', async () => {
      referralService.trackPurchaseEvent.mockResolvedValue(undefined);

      await controller.trackPurchase(user, purchaseBody);

      expect(referralService.trackPurchaseEvent).toHaveBeenCalledWith({
        ucc: purchaseBody.ucc,
        userId: user.uuid,
        email: user.email,
        name: `${user.name} ${user.lastname}`.trim(),
        price: purchaseBody.price,
        currency: purchaseBody.currency,
        invoiceId: purchaseBody.invoiceId,
        interval: purchaseBody.interval,
        productKey: purchaseBody.productKey,
        subscriptionId: purchaseBody.subscriptionId,
      });
    });
  });
});
