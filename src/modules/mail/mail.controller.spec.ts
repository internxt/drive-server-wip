import { Test, type TestingModule } from '@nestjs/testing';
import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { ConflictException } from '@nestjs/common';
import { MailController } from './mail.controller';
import { MailUseCases } from './mail.usecase';
import { newUser } from '../../../test/fixtures';
import { PaymentRequiredException } from '../feature-limit/exceptions/payment-required.exception';

describe('MailController', () => {
  let controller: MailController;
  let mailUseCases: DeepMocked<MailUseCases>;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MailController],
    })
      .useMocker(() => createMock())
      .compile();

    controller = moduleRef.get(MailController);
    mailUseCases = moduleRef.get(MailUseCases);
  });

  describe('createMailAccount', () => {
    const dto = {
      address: 'john',
      domain: 'inxt.eu',
      displayName: 'John Doe',
      password: 'encrypted-password',
    };

    it('When called with valid input, then it should return the usecase result', async () => {
      const user = newUser();
      const expected = {
        token: 'token',
        newToken: 'newToken',
        address: 'john@inxt.eu',
      };

      mailUseCases.createMailAccount.mockResolvedValueOnce(expected);

      const result = await controller.createMailAccount(user, dto);

      expect(result).toEqual(expected);
      expect(mailUseCases.createMailAccount).toHaveBeenCalledWith(user, dto);
    });

    it('When user has no mail access, then it should propagate PaymentRequiredException', async () => {
      const user = newUser();

      mailUseCases.createMailAccount.mockRejectedValueOnce(
        new PaymentRequiredException('Mail access is not available'),
      );

      await expect(controller.createMailAccount(user, dto)).rejects.toThrow(
        PaymentRequiredException,
      );
    });

    it('When user already has a mail account, then it should propagate ConflictException', async () => {
      const user = newUser();

      mailUseCases.createMailAccount.mockRejectedValueOnce(
        new ConflictException('User already has a mail account'),
      );

      await expect(controller.createMailAccount(user, dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
