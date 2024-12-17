import { newUser } from './../../../test/fixtures';
import { AuthController } from './auth.controller';
import { UserUseCases } from '../user/user.usecase';
import { KeyServerUseCases } from '../keyserver/key-server.usecase';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { LoginDto } from './dto/login-dto';
import { LoginAccessDto } from './dto/login-access-dto';
import { Response } from 'express';
import { NotFoundException } from '@nestjs/common';
import { KeyServer } from '../keyserver/key-server.domain';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { v4 } from 'uuid';

describe('AuthController', () => {
  let authController: AuthController;
  let userUseCases: DeepMocked<UserUseCases>;
  let keyServerUseCases: DeepMocked<KeyServerUseCases>;
  let cryptoService: DeepMocked<CryptoService>;

  beforeEach(async () => {
    userUseCases = createMock<UserUseCases>();
    keyServerUseCases = createMock<KeyServerUseCases>();
    cryptoService = createMock<CryptoService>();

    authController = new AuthController(
      userUseCases,
      keyServerUseCases,
      cryptoService,
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

    it('When user is not found, then it should throw NotFoundException', async () => {
      const clientId = 'drive-mobile';
      const loginDto = new LoginDto();
      loginDto.email = 'test@example.com';

      jest.spyOn(userUseCases, 'findByEmail').mockResolvedValueOnce(null);

      await expect(authController.login(loginDto, clientId)).rejects.toThrow(
        NotFoundException,
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
});
