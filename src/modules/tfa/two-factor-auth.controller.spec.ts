import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { newUser } from './../../../test/fixtures';
import { TwoFactorAuthController } from './two-factor-auth.controller';
import { TwoFactorAuthService } from './two-factor-auth.service';
import { UserUseCases } from '../user/user.usecase';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { UpdateTfaDto } from './dto/update-tfa.dto';
import { DeleteTfaDto } from './dto/delete-tfa.dto';
import {
  BadRequestException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { GeneratedSecret } from 'speakeasy';
import { v4 } from 'uuid';

describe('TwoFactorAuthController', () => {
  let tfaController: TwoFactorAuthController;
  let userUseCases: DeepMocked<UserUseCases>;
  let cryptoService: DeepMocked<CryptoService>;
  let twoFactorAuthService: DeepMocked<TwoFactorAuthService>;

  beforeEach(async () => {
    userUseCases = createMock<UserUseCases>();
    cryptoService = createMock<CryptoService>();
    twoFactorAuthService = createMock<TwoFactorAuthService>();

    tfaController = new TwoFactorAuthController(
      userUseCases,
      cryptoService,
      twoFactorAuthService,
    );
  });

  describe('GET /', () => {
    it('When a user requests 2FA secret, then it should return with the 2FA secret and QR code', async () => {
      const user = newUser();
      const secret = 'secret';
      const qrCode = 'qrCode';
      const mockGeneratedSecret: GeneratedSecret = {
        ascii: null,
        base32: secret,
        hex: null,
        google_auth_qr: null,
      };

      jest
        .spyOn(twoFactorAuthService, 'generateTwoFactorAuthSecret')
        .mockResolvedValueOnce({
          secret: mockGeneratedSecret,
          qrCode: qrCode,
        });

      const result = await tfaController.getTfa(user);

      expect(result).toEqual({ code: secret, qr: qrCode });
    });

    it('When a user already has 2FA enabled, then it should throw', async () => {
      const user = newUser();
      user.secret_2FA = 'secret';

      await expect(tfaController.getTfa(user)).rejects.toThrow(HttpException);
    });
  });

  describe('PUT /', () => {
    it('When valid 2FA update details are provided, then it should return', async () => {
      const user = newUser();
      const updateTfaDto = new UpdateTfaDto();
      updateTfaDto.key = 'key';
      updateTfaDto.code = 'code';

      jest
        .spyOn(twoFactorAuthService, 'validateTwoFactorAuthCode')
        .mockResolvedValueOnce(true);
      jest.spyOn(userUseCases, 'updateByUuid').mockResolvedValueOnce();

      const result = await tfaController.putTfa(user, updateTfaDto);

      expect(result).toEqual({ message: 'ok' });
    });

    it('When a user already has 2FA enabled, then it should throw', async () => {
      const user = newUser();
      user.secret_2FA = 'secret';
      const updateTfaDto = new UpdateTfaDto();

      await expect(tfaController.putTfa(user, updateTfaDto)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('DELETE /', () => {
    it('When a user requests to delete 2FA, then it should return', async () => {
      const user = newUser();
      user.secret_2FA = 'secret';
      user.password = v4();
      const deleteTfaDto = new DeleteTfaDto();
      deleteTfaDto.code = 'code';
      deleteTfaDto.pass = 'pass';

      jest
        .spyOn(twoFactorAuthService, 'validateTwoFactorAuthCode')
        .mockResolvedValueOnce(true);
      jest
        .spyOn(cryptoService, 'decryptText')
        .mockReturnValueOnce(user.password);
      jest.spyOn(userUseCases, 'updateByUuid').mockResolvedValueOnce();

      const result = await tfaController.deleteTfa(user, deleteTfaDto);

      expect(result).toEqual({ message: 'ok' });
    });

    it('When a user does not have 2FA activated, Then it should throw a 404 error', async () => {
      const user = newUser();
      const deleteTfaDto = new DeleteTfaDto();

      await expect(tfaController.deleteTfa(user, deleteTfaDto)).rejects.toThrow(
        new NotFoundException('Your account does not have 2FA activated.'),
      );
    });

    it('When the provided password is invalid, then it should throw', async () => {
      const user = newUser();
      user.secret_2FA = 'secret';
      user.password = v4();
      const deleteTfaDto = new DeleteTfaDto();
      deleteTfaDto.code = 'code';
      deleteTfaDto.pass = 'invalid-pass';

      jest
        .spyOn(twoFactorAuthService, 'validateTwoFactorAuthCode')
        .mockResolvedValueOnce(true);
      jest
        .spyOn(cryptoService, 'decryptText')
        .mockReturnValueOnce('invalid-password');

      await expect(tfaController.deleteTfa(user, deleteTfaDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
