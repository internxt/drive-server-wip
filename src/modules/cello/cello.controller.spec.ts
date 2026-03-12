import { type Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type DeepMocked, createMock } from '@golevelup/ts-jest';
import { newUser } from '../../../test/fixtures';
import { CelloController } from './cello.controller';
import { CelloService } from './cello.service';

describe('CelloController', () => {
  let controller: CelloController;
  let celloService: DeepMocked<CelloService>;

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
      controllers: [CelloController],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    controller = moduleRef.get(CelloController);
    celloService = moduleRef.get(CelloService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /token', () => {
    it('When called, then it returns the generated token', async () => {
      celloService.generateToken.mockReturnValue('jwt-token');

      const result = await controller.generateToken(user);

      expect(result).toEqual({ token: 'jwt-token' });
      expect(celloService.generateToken).toHaveBeenCalledWith(user.uuid);
    });
  });

  describe('POST /track-purchase', () => {
    it('When called, then it delegates to the service with mapped params', async () => {
      celloService.trackPurchaseEvent.mockResolvedValue(undefined);

      await controller.trackPurchase(user, purchaseBody);

      expect(celloService.trackPurchaseEvent).toHaveBeenCalledWith({
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
