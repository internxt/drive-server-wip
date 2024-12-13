import { newUser } from './../../../test/fixtures';
import { AuthController } from './auth.controller';
import { UserUseCases } from '../user/user.usecase';
import { KeyServerUseCases } from '../keyserver/key-server.usecase';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { LoginDto } from './dto/login-dto';
import { LoginAccessDto } from './dto/login-access-dto';
import { Response, Request } from 'express';
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
    it('should return user data', async () => {
      const req = {
        headers: {
          'internxt-client': 'drive-mobile',
        },
      } as unknown as Request;
      const res = {
        status: jest.fn(() => res),
        send: jest.fn(),
      } as unknown as Response;
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

      await authController.login(loginDto, req, res);

      expect(res.status).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledTimes(1);
      expect(res.send).toHaveBeenCalledWith({
        hasKeys: keys,
        sKey: 'encryptedText',
        tfa: true,
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      const req = {
        headers: {
          'internxt-client': 'drive-mobile',
        },
      } as unknown as Request;
      const res = {
        status: jest.fn(() => res),
        send: jest.fn(),
      } as unknown as Response;
      const loginDto = new LoginDto();
      loginDto.email = 'test@example.com';

      jest.spyOn(userUseCases, 'findByEmail').mockResolvedValueOnce(null);

      await expect(authController.login(loginDto, req, res)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('POST /login/access', () => {
    it('should call loginAccess method', async () => {
      const loginAccessDto = new LoginAccessDto();
      loginAccessDto.email = 'user_test@gmail.com';
      loginAccessDto.password = v4();
      loginAccessDto.privateKey = 'privateKey';
      loginAccessDto.publicKey = 'publicKey';
      loginAccessDto.revocateKey = 'revocateKey';

      await authController.loginAccess(loginAccessDto);

      expect(userUseCases.loginAccess).toHaveBeenCalledTimes(1);
      expect(userUseCases.loginAccess).toHaveBeenCalledWith(loginAccessDto);
    });
  });

  describe('GET /logout', () => {
    it('should return logout response', async () => {
      const user = newUser();

      const res = {
        send: jest.fn(),
      } as unknown as Response;

      await authController.logout(user, res);

      expect(res.send).toHaveBeenCalledTimes(1);
      expect(res.send).toHaveBeenCalledWith({ logout: true });
    });
  });
});
