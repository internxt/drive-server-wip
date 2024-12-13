import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { newUser } from './../../../test/fixtures';
import { TwoFactorAuthController } from './two-factor-auth.controller';
import { TwoFactorAuthService } from './two-factor-auth.service';
import { UserUseCases } from '../user/user.usecase';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { UpdateTfaDto } from './dto/update-tfa.dto';
import { DeleteTfaDto } from './dto/delete-tfa.dto';
import { BadRequestException, HttpException } from '@nestjs/common';
import { GeneratedSecret } from 'speakeasy';

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
    it('should return a 200 response with the 2FA secret and QR code', async () => {
      const user = newUser();
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };
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

      await tfaController.getTfa(user, res as any);

      expect(res.status).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledTimes(1);
      expect(res.send).toHaveBeenCalledWith({ code: secret, qr: qrCode });
    });

    it('should throw a 409 error if the user already has 2FA', async () => {
      const user = newUser();
      user.secret_2FA = 'secret';
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await expect(tfaController.getTfa(user, res as any)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('PUT /', () => {
    it('should return a 200 response with a success message', async () => {
      const user = newUser();
      const updateTfaDto = new UpdateTfaDto();
      updateTfaDto.key = 'key';
      updateTfaDto.code = 'code';
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      jest
        .spyOn(twoFactorAuthService, 'validateTwoFactorAuthCode')
        .mockResolvedValueOnce(true);
      jest.spyOn(userUseCases, 'updateByUuid').mockResolvedValueOnce();

      await tfaController.putTfa(user, updateTfaDto, res as any);

      expect(res.status).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledTimes(1);
      expect(res.send).toHaveBeenCalledWith({ message: 'ok' });
    });

    it('should throw a 409 error if the user already has 2FA', async () => {
      const user = newUser();
      user.secret_2FA = 'secret';
      const updateTfaDto = new UpdateTfaDto();
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await expect(
        tfaController.putTfa(user, updateTfaDto, res as any),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('DELETE /', () => {
    it('should return a 200 response with a success message', async () => {
      const user = newUser();
      user.secret_2FA = 'secret';
      user.password = 'password';
      const deleteTfaDto = new DeleteTfaDto();
      deleteTfaDto.code = 'code';
      deleteTfaDto.pass = 'pass';
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      jest
        .spyOn(twoFactorAuthService, 'validateTwoFactorAuthCode')
        .mockResolvedValueOnce(true);
      jest.spyOn(cryptoService, 'decryptText').mockReturnValueOnce('password');
      jest.spyOn(userUseCases, 'updateByUuid').mockResolvedValueOnce();

      await tfaController.deleteTfa(user, deleteTfaDto, res as any);

      expect(res.status).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledTimes(1);
      expect(res.send).toHaveBeenCalledWith({ message: 'ok' });
    });

    it('should throw a 204 error if the user does not have 2FA activated', async () => {
      const user = newUser();
      const deleteTfaDto = new DeleteTfaDto();
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await expect(
        tfaController.deleteTfa(user, deleteTfaDto, res as any),
      ).rejects.toThrow(HttpException);
    });

    it('should throw a 400 error if the password is invalid', async () => {
      const user = newUser();
      user.secret_2FA = 'secret';
      user.password = 'password';
      const deleteTfaDto = new DeleteTfaDto();
      deleteTfaDto.code = 'code';
      deleteTfaDto.pass = 'invalid-pass';
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      jest
        .spyOn(twoFactorAuthService, 'validateTwoFactorAuthCode')
        .mockResolvedValueOnce(true);
      jest
        .spyOn(cryptoService, 'decryptText')
        .mockReturnValueOnce('invalid-password');

      await expect(
        tfaController.deleteTfa(user, deleteTfaDto, res as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
