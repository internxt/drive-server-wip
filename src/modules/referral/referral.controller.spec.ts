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
});
