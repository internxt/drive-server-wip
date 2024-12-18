import { newUser } from './../../../test/fixtures';
import { AuthController } from './auth.controller';
import { UserUseCases } from '../user/user.usecase';
import { KeyServerUseCases } from '../keyserver/key-server.usecase';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { LoginDto } from './dto/login-dto';
import { LoginAccessDto } from './dto/login-access.dto';
import { Response } from 'express';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { KeyServer } from '../keyserver/key-server.domain';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { v4 } from 'uuid';
import { TwoFactorAuthService } from './two-factor-auth.service';
import { GeneratedSecret } from 'speakeasy';
import { UpdateTfaDto } from './dto/update-tfa.dto';
import { DeleteTfaDto } from './dto/delete-tfa.dto';

describe('AuthController', () => {
  let authController: AuthController;
  let userUseCases: DeepMocked<UserUseCases>;
  let keyServerUseCases: DeepMocked<KeyServerUseCases>;
  let cryptoService: DeepMocked<CryptoService>;
  let twoFactorAuthService: DeepMocked<TwoFactorAuthService>;

  beforeEach(async () => {
    userUseCases = createMock<UserUseCases>();
    keyServerUseCases = createMock<KeyServerUseCases>();
    cryptoService = createMock<CryptoService>();
    twoFactorAuthService = createMock<TwoFactorAuthService>();

    authController = new AuthController(
      userUseCases,
      keyServerUseCases,
      cryptoService,
      twoFactorAuthService,
    );
  });

  it('should be defined', () => {
    expect(authController).toBeDefined();
  });

  describe('POST /login', () => {
    it('When valid credentials are provided, then it should return security details', async () => {
      const clientId = 'drive-mobile';
      const loginDto = new LoginDto();
      loginDto.email = 'test@example.com';

      const user = newUser();
      user.hKey = 'hKey';
      user.secret_2FA = 'secret_2FA';

      const keys: Omit<
        KeyServer,
        'id' | 'userId' | 'encryptVersion' | 'toJSON'
      > = {
        publicKey: 'publicKey',
        privateKey: 'privateKey',
        revocationKey: 'revocationKey',
      };

      jest.spyOn(userUseCases, 'findByEmail').mockResolvedValueOnce(user);
      jest.spyOn(keyServerUseCases, 'findUserKeys').mockResolvedValueOnce(keys);
      jest.spyOn(cryptoService, 'encryptText').mockReturnValue('encryptedText');

      const res = {
        status: jest.fn(() => res),
        send: jest.fn(),
      } as unknown as Response;

      const result = await authController.login(loginDto, clientId);

      expect(result).toEqual({
        hasKeys: keys,
        sKey: 'encryptedText',
        tfa: true,
      });
    });

    it('When user is not found, then it should throw UnauthorizedException', async () => {
      const clientId = 'drive-mobile';
      const loginDto = new LoginDto();
      loginDto.email = 'test@example.com';

      jest.spyOn(userUseCases, 'findByEmail').mockResolvedValueOnce(null);

      await expect(authController.login(loginDto, clientId)).rejects.toThrow(
        new UnauthorizedException('Wrong login credentials'),
      );
    });
  });

  describe('POST /login/access', () => {
    const loginAccessDto = new LoginAccessDto();
    loginAccessDto.email = 'user_test@gmail.com';
    loginAccessDto.password = v4();
    loginAccessDto.privateKey = 'privateKey';
    loginAccessDto.publicKey = 'publicKey';
    loginAccessDto.revocateKey = 'revocateKey';

    it('When valid login access details are provided, then it should return the result of loginAccess', async () => {
      jest
        .spyOn(userUseCases, 'loginAccess')
        .mockResolvedValueOnce({ success: true } as any);

      const result = await authController.loginAccess(loginAccessDto);

      expect(userUseCases.loginAccess).toHaveBeenCalledTimes(1);
      expect(userUseCases.loginAccess).toHaveBeenCalledWith(loginAccessDto);
      expect(result).toEqual({ success: true });
    });

    it('When an error occurs during login access, then it should throw an error', async () => {
      userUseCases.loginAccess = jest
        .fn()
        .mockRejectedValue(new Error('Login access error'));

      await expect(authController.loginAccess(loginAccessDto)).rejects.toThrow(
        Error,
      );
    });
  });

  describe('GET /logout', () => {
    it('When a user logs out, then it should return a logout confirmation', async () => {
      const user = newUser();

      const result = await authController.logout(user);

      expect(result).toEqual({ logout: true });
    });
  });

  describe('GET /tfa', () => {
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

      const result = await authController.getTfa(user);

      expect(result).toEqual({ code: secret, qr: qrCode });
    });

    it('When a user already has 2FA enabled, then it should throw', async () => {
      const user = newUser();
      user.secret_2FA = 'secret';

      await expect(authController.getTfa(user)).rejects.toThrow(
        new ConflictException('User has already 2FA'),
      );
    });
  });

  describe('PUT /tfa', () => {
    it('When valid 2FA update details are provided, then it should return', async () => {
      const user = newUser();
      const updateTfaDto = new UpdateTfaDto();
      updateTfaDto.key = 'key';
      updateTfaDto.code = 'code';

      jest
        .spyOn(twoFactorAuthService, 'validateTwoFactorAuthCode')
        .mockReturnValueOnce(true);
      jest.spyOn(userUseCases, 'updateByUuid').mockResolvedValueOnce();

      const result = await authController.putTfa(user, updateTfaDto);

      expect(result).toEqual({ message: 'ok' });
    });

    it('When a user already has 2FA enabled, then it should throw', async () => {
      const user = newUser();
      user.secret_2FA = 'secret';
      const updateTfaDto = new UpdateTfaDto();

      await expect(authController.putTfa(user, updateTfaDto)).rejects.toThrow(
        new ConflictException('User has already 2FA'),
      );
    });
  });

  describe('DELETE /tfa', () => {
    it('When a user requests to delete 2FA, then it should return', async () => {
      const user = newUser();
      user.secret_2FA = 'secret';
      user.password = v4();
      const deleteTfaDto = new DeleteTfaDto();
      deleteTfaDto.code = 'code';
      deleteTfaDto.pass = 'pass';

      jest
        .spyOn(twoFactorAuthService, 'validateTwoFactorAuthCode')
        .mockReturnValueOnce(true);
      jest
        .spyOn(cryptoService, 'decryptText')
        .mockReturnValueOnce(user.password);
      jest.spyOn(userUseCases, 'updateByUuid').mockResolvedValueOnce();

      const result = await authController.deleteTfa(user, deleteTfaDto);

      expect(result).toEqual({ message: 'ok' });
    });

    it('When a user does not have 2FA activated, Then it should throw a 404 error', async () => {
      const user = newUser();
      const deleteTfaDto = new DeleteTfaDto();

      await expect(
        authController.deleteTfa(user, deleteTfaDto),
      ).rejects.toThrow(
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
        .mockReturnValueOnce(true);
      jest
        .spyOn(cryptoService, 'decryptText')
        .mockReturnValueOnce('invalid-password');

      await expect(
        authController.deleteTfa(user, deleteTfaDto),
      ).rejects.toThrow(new BadRequestException('Invalid password'));
    });
  });
});
