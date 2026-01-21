import { newKeyServer, newUser } from './../../../test/fixtures';
import { AuthController } from './auth.controller';
import { UserUseCases } from '../user/user.usecase';
import { KeyServerUseCases } from '../keyserver/key-server.usecase';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { LoginDto } from './dto/login-dto';
import { LoginAccessDto } from './dto/login-access.dto';
import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { v4 } from 'uuid';
import { TwoFactorAuthService } from './two-factor-auth.service';
import { GeneratedSecret } from 'speakeasy';
import { UpdateTfaDto } from './dto/update-tfa.dto';
import { DeleteTfaDto } from './dto/delete-tfa.dto';
import { UserKeysEncryptVersions } from '../keyserver/key-server.domain';
import { Test } from '@nestjs/testing';
import { FeatureLimitService } from '../feature-limit/feature-limit.service';
import { PaymentRequiredException } from '../feature-limit/exceptions/payment-required.exception';
import { PlatformName } from '../../common/constants';
import { ClientEnum } from '../../common/enums/platform.enum';

describe('AuthController', () => {
  let authController: AuthController;
  let userUseCases: DeepMocked<UserUseCases>;
  let keyServerUseCases: DeepMocked<KeyServerUseCases>;
  let cryptoService: DeepMocked<CryptoService>;
  let twoFactorAuthService: DeepMocked<TwoFactorAuthService>;
  let featureLimitService: DeepMocked<FeatureLimitService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();
    authController = moduleRef.get(AuthController);
    userUseCases = moduleRef.get(UserUseCases);
    keyServerUseCases = moduleRef.get(KeyServerUseCases);
    cryptoService = moduleRef.get(CryptoService);
    twoFactorAuthService = moduleRef.get(TwoFactorAuthService);
    featureLimitService = moduleRef.get(FeatureLimitService);
  });

  it('should be defined', () => {
    expect(authController).toBeDefined();
  });

  describe('POST /login', () => {
    it('When valid credentials are provided, then it should return security details', async () => {
      const loginDto = new LoginDto();
      loginDto.email = 'test@example.com';

      const user = newUser();
      user.hKey = 'hKey';
      user.secret_2FA = 'secret_2FA';

      const eccKeys = newKeyServer({ userId: user.id });
      const kyberKeys = newKeyServer({
        userId: user.id,
        encryptVersion: UserKeysEncryptVersions.Kyber,
      });

      jest.spyOn(userUseCases, 'findByEmail').mockResolvedValueOnce(user);
      jest
        .spyOn(keyServerUseCases, 'findUserKeys')
        .mockResolvedValueOnce({ ecc: eccKeys, kyber: kyberKeys });
      jest.spyOn(cryptoService, 'encryptText').mockReturnValue('encryptedText');

      const result = await authController.login(loginDto);

      expect(result).toEqual({
        hasKeys: true,
        hasKyberKeys: true,
        hasEccKeys: true,
        sKey: 'encryptedText',
        tfa: true,
      });
    });

    it('When user is not found, then it should throw UnauthorizedException', async () => {
      const loginDto = new LoginDto();
      loginDto.email = 'test@example.com';

      jest.spyOn(userUseCases, 'findByEmail').mockResolvedValueOnce(null);

      await expect(authController.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Wrong login credentials'),
      );
    });

    it('When an email in uppercase is provided, then it should be transformed to lowercase', async () => {
      const body = { email: 'TEST@EXAMPLE.COM' };
      const emailLowerCase = 'test@example.com';
      const user = newUser({ attributes: { email: emailLowerCase } });

      jest.spyOn(userUseCases, 'findByEmail').mockResolvedValue(user);

      await authController.login(body);

      expect(userUseCases.findByEmail).toHaveBeenCalledWith(emailLowerCase);
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
      const eccKey = newKeyServer({ ...loginAccessDto });

      jest.spyOn(keyServerUseCases, 'parseKeysInput').mockReturnValueOnce({
        ecc: eccKey.toJSON(),
        kyber: null,
      });

      jest
        .spyOn(userUseCases, 'loginAccess')
        .mockResolvedValueOnce({ success: true } as any);

      const result = await authController.loginAccess(loginAccessDto);

      expect(userUseCases.loginAccess).toHaveBeenCalledTimes(1);
      expect(userUseCases.loginAccess).toHaveBeenCalledWith({
        ...loginAccessDto,
        keys: {
          ecc: {
            publicKey: eccKey.publicKey,
            privateKey: eccKey.privateKey,
            revocationKey: eccKey.revocationKey,
          },
          kyber: null,
        },
      });
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

    it('When kyber and ecc keys are sent, then it should make the call with the respective keys', async () => {
      const eccKey = newKeyServer();
      const kyberKey = newKeyServer({
        encryptVersion: UserKeysEncryptVersions.Kyber,
      });

      const inputWithKyberKeys = { ...loginAccessDto };
      inputWithKyberKeys.keys = {
        ecc: {
          ...eccKey.toJSON(),
        },
        kyber: {
          ...kyberKey.toJSON(),
        },
      };

      jest.spyOn(keyServerUseCases, 'parseKeysInput').mockReturnValueOnce({
        ecc: eccKey.toJSON(),
        kyber: kyberKey.toJSON(),
      });

      jest.spyOn(userUseCases, 'loginAccess');

      await authController.loginAccess(inputWithKyberKeys);

      expect(userUseCases.loginAccess).toHaveBeenCalledWith({
        ...inputWithKyberKeys,
        keys: {
          ecc: {
            ...eccKey.toJSON(),
          },
          kyber: {
            ...kyberKey.toJSON(),
          },
        },
      });
    });
  });

  describe('GET /logout', () => {
    it('When a user logs out, then it should return a logout confirmation', async () => {
      const jwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkMzY3YmJmMS01OTFmLTQyODMtYjQwMi04MGIzODhlMzY2ZGMiLCJzdWIiOiIzMzk1OGYyNi0yOWUyLTQ4Y2EtOTIzMC03ODJiYjI0ODljOWMiLCJwYXlsb2FkIjp7InV1aWQiOiIzMzk1OGYyNi0yOWUyLTQ4Y2EtOTIzMC03ODJiYjI0ODljOWMiLCJ3b3Jrc3BhY2VzIjp7Im93bmVycyI6W119fSwiaWF0IjoxNzUxOTAzMTUyLCJleHAiOjE3NTIxNjIzNTJ9.I62Te4xDBJpa3gE8f2gyWfljFrzJPrJggrFAhnXcvxU';

      const result = await authController.logout(jwt);

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
    it('When a user requests to delete 2FA with both password and code, then it should validate both and return', async () => {
      const user = newUser();
      user.secret_2FA = 'secret';
      user.password = v4();
      const deleteTfaDto = new DeleteTfaDto();
      deleteTfaDto.code = 'code';
      deleteTfaDto.pass = 'pass';

      const validateTfaSpy = jest
        .spyOn(twoFactorAuthService, 'validateTwoFactorAuthCode')
        .mockReturnValueOnce(true);
      const decryptPasswordSpy = jest
        .spyOn(cryptoService, 'decryptText')
        .mockReturnValueOnce(user.password);
      jest.spyOn(userUseCases, 'updateByUuid').mockResolvedValueOnce();

      const result = await authController.deleteTfa(user, deleteTfaDto);

      expect(validateTfaSpy).toHaveBeenCalledWith(user.secret_2FA, 'code');
      expect(decryptPasswordSpy).toHaveBeenCalled();
      expect(result).toEqual({ message: 'ok' });
    });

    it('When a user requests to delete 2FA with only password, then it should validate password only', async () => {
      const user = newUser();
      user.secret_2FA = 'secret';
      user.password = v4();
      const deleteTfaDto = new DeleteTfaDto();
      deleteTfaDto.pass = 'pass';

      const validateTfaSpy = jest.spyOn(
        twoFactorAuthService,
        'validateTwoFactorAuthCode',
      );
      jest
        .spyOn(cryptoService, 'decryptText')
        .mockReturnValueOnce(user.password);
      jest.spyOn(userUseCases, 'updateByUuid').mockResolvedValueOnce();

      const result = await authController.deleteTfa(user, deleteTfaDto);

      expect(validateTfaSpy).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'ok' });
    });

    it('When a user requests to delete 2FA with only TFA code, then it should validate code only', async () => {
      const user = newUser();
      user.secret_2FA = 'secret';
      user.password = v4();
      const deleteTfaDto = new DeleteTfaDto();
      deleteTfaDto.code = 'code';

      jest
        .spyOn(twoFactorAuthService, 'validateTwoFactorAuthCode')
        .mockReturnValueOnce(true);
      const decryptPasswordSpy = jest.spyOn(cryptoService, 'decryptText');
      jest.spyOn(userUseCases, 'updateByUuid').mockResolvedValueOnce();

      const result = await authController.deleteTfa(user, deleteTfaDto);

      expect(decryptPasswordSpy).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'ok' });
    });

    it('When neither password nor code are provided, then it should throw', async () => {
      const user = newUser();
      user.secret_2FA = 'secret';
      const deleteTfaDto = new DeleteTfaDto();

      await expect(
        authController.deleteTfa(user, deleteTfaDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('When a user does not have 2FA activated, Then it should throw a 404 error', async () => {
      const user = newUser();
      const deleteTfaDto = new DeleteTfaDto();
      deleteTfaDto.code = 'code';
      deleteTfaDto.pass = 'pass';

      await expect(
        authController.deleteTfa(user, deleteTfaDto),
      ).rejects.toThrow(
        new NotFoundException('Your account does not have 2FA activated.'),
      );
    });

    it('When both password and code are provided but password is invalid, then it should throw', async () => {
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

  describe('GET /are-credentials-correct', () => {
    it('When credentials need to be checked, then it should call the respective service correctly', async () => {
      const hashedPassword = '$2b$12$qEwggJIve0bWR4GRCb7KXuF0aKi5GI8vfvf';
      const user = newUser();

      jest.spyOn(userUseCases, 'areCredentialsCorrect');

      await authController.areCredentialsCorrect(user, {
        hashedPassword,
      });

      expect(userUseCases.areCredentialsCorrect).toHaveBeenCalledWith(
        user,
        hashedPassword,
      );
    });
  });

  describe('POST /cli/login/access', () => {
    const loginAccessDto = new LoginAccessDto();
    loginAccessDto.email = 'cli_user@gmail.com';
    loginAccessDto.password = v4();
    loginAccessDto.privateKey = 'privateKey';
    loginAccessDto.publicKey = 'publicKey';
    loginAccessDto.revocateKey = 'revocateKey';

    it('When valid CLI login with new header and user can access platform, then it should return successfully', async () => {
      const eccKey = newKeyServer({ ...loginAccessDto });
      const mockUser = newUser({ attributes: { tierId: v4() } });
      const mockLoginResult = {
        user: mockUser,
        token: 'jwt-token',
        newToken: 'new-jwt-token',
      } as any;

      jest.spyOn(keyServerUseCases, 'parseKeysInput').mockReturnValueOnce({
        ecc: eccKey.toJSON(),
        kyber: null,
      });

      jest
        .spyOn(userUseCases, 'loginAccess')
        .mockResolvedValueOnce(mockLoginResult);

      jest
        .spyOn(featureLimitService, 'canUserAccessPlatform')
        .mockResolvedValueOnce(true);

      const result = await authController.cliLoginAccess(
        loginAccessDto,
        ClientEnum.Cli,
      );

      expect(userUseCases.loginAccess).toHaveBeenCalledWith({
        ...loginAccessDto,
        keys: {
          ecc: {
            publicKey: eccKey.publicKey,
            privateKey: eccKey.privateKey,
            revocationKey: eccKey.revocationKey,
          },
          kyber: null,
        },
        platform: PlatformName.CLI,
      });
      expect(featureLimitService.canUserAccessPlatform).toHaveBeenCalledWith(
        PlatformName.CLI,
        mockUser.uuid,
      );
      expect(result).toEqual(mockLoginResult);
    });

    it('When valid CLI login with legacy header and user can access platform, then it should return successfully', async () => {
      const eccKey = newKeyServer({ ...loginAccessDto });
      const mockUser = newUser({ attributes: { tierId: v4() } });
      const mockLoginResult = {
        user: mockUser,
        token: 'jwt-token',
        newToken: 'new-jwt-token',
      } as any;

      jest.spyOn(keyServerUseCases, 'parseKeysInput').mockReturnValueOnce({
        ecc: eccKey.toJSON(),
        kyber: null,
      });

      jest
        .spyOn(userUseCases, 'loginAccess')
        .mockResolvedValueOnce(mockLoginResult);

      jest
        .spyOn(featureLimitService, 'canUserAccessPlatform')
        .mockResolvedValueOnce(true);

      const result = await authController.cliLoginAccess(
        loginAccessDto,
        ClientEnum.CliLegacy,
      );

      expect(userUseCases.loginAccess).toHaveBeenCalledWith({
        ...loginAccessDto,
        keys: {
          ecc: {
            publicKey: eccKey.publicKey,
            privateKey: eccKey.privateKey,
            revocationKey: eccKey.revocationKey,
          },
          kyber: null,
        },
        platform: PlatformName.CLI,
      });
      expect(featureLimitService.canUserAccessPlatform).toHaveBeenCalledWith(
        PlatformName.CLI,
        mockUser.uuid,
      );
      expect(result).toEqual(mockLoginResult);
    });

    it('When valid Rclone login and user can access platform, then it should return successfully', async () => {
      const eccKey = newKeyServer({ ...loginAccessDto });
      const mockUser = newUser({ attributes: { tierId: v4() } });
      const mockLoginResult = {
        user: mockUser,
        token: 'jwt-token',
        newToken: 'new-jwt-token',
      } as any;

      jest.spyOn(keyServerUseCases, 'parseKeysInput').mockReturnValueOnce({
        ecc: eccKey.toJSON(),
        kyber: null,
      });

      jest
        .spyOn(userUseCases, 'loginAccess')
        .mockResolvedValueOnce(mockLoginResult);

      jest
        .spyOn(featureLimitService, 'canUserAccessPlatform')
        .mockResolvedValueOnce(true);

      const result = await authController.cliLoginAccess(
        loginAccessDto,
        ClientEnum.Rclone,
      );

      expect(userUseCases.loginAccess).toHaveBeenCalledWith({
        ...loginAccessDto,
        keys: {
          ecc: {
            publicKey: eccKey.publicKey,
            privateKey: eccKey.privateKey,
            revocationKey: eccKey.revocationKey,
          },
          kyber: null,
        },
        platform: PlatformName.RCLONE,
      });
      expect(featureLimitService.canUserAccessPlatform).toHaveBeenCalledWith(
        PlatformName.RCLONE,
        mockUser.uuid,
      );
      expect(result).toEqual(mockLoginResult);
    });

    it('When unknown client header is provided, then it should throw BadRequestException', async () => {
      await expect(
        authController.cliLoginAccess(loginAccessDto, 'unknown-client'),
      ).rejects.toThrow(BadRequestException);
    });

    it('When user cannot access CLI platform, then it should throw PaymentRequiredException', async () => {
      const eccKey = newKeyServer({ ...loginAccessDto });
      const mockUser = newUser({ attributes: { tierId: 'free_id' } });
      const mockLoginResult = {
        success: true,
        user: mockUser,
        token: 'jwt-token',
      } as any;

      jest.spyOn(keyServerUseCases, 'parseKeysInput').mockReturnValueOnce({
        ecc: eccKey.toJSON(),
        kyber: null,
      });

      jest
        .spyOn(userUseCases, 'loginAccess')
        .mockResolvedValueOnce(mockLoginResult);

      jest
        .spyOn(featureLimitService, 'canUserAccessPlatform')
        .mockResolvedValueOnce(false);

      await expect(
        authController.cliLoginAccess(loginAccessDto, ClientEnum.Cli),
      ).rejects.toThrow(PaymentRequiredException);

      expect(featureLimitService.canUserAccessPlatform).toHaveBeenCalledWith(
        PlatformName.CLI,
        mockUser.uuid,
      );
    });

    it('When user cannot access Rclone platform, then it should throw PaymentRequiredException', async () => {
      const eccKey = newKeyServer({ ...loginAccessDto });
      const mockUser = newUser({ attributes: { tierId: 'free_id' } });
      const mockLoginResult = {
        success: true,
        user: mockUser,
        token: 'jwt-token',
      } as any;

      jest.spyOn(keyServerUseCases, 'parseKeysInput').mockReturnValueOnce({
        ecc: eccKey.toJSON(),
        kyber: null,
      });

      jest
        .spyOn(userUseCases, 'loginAccess')
        .mockResolvedValueOnce(mockLoginResult);

      jest
        .spyOn(featureLimitService, 'canUserAccessPlatform')
        .mockResolvedValueOnce(false);

      await expect(
        authController.cliLoginAccess(loginAccessDto, ClientEnum.Rclone),
      ).rejects.toThrow(PaymentRequiredException);

      expect(featureLimitService.canUserAccessPlatform).toHaveBeenCalledWith(
        PlatformName.RCLONE,
        mockUser.uuid,
      );
    });

    it('When CLI login access includes both ecc and kyber keys, then it should parse and pass them correctly', async () => {
      const eccKey = newKeyServer();
      const kyberKey = newKeyServer({
        encryptVersion: UserKeysEncryptVersions.Kyber,
      });
      const mockUser = newUser({ attributes: { tierId: v4() } });
      const mockLoginResult = {
        success: true,
        user: mockUser,
        token: 'jwt-token',
      } as any;

      const inputWithKyberKeys = { ...loginAccessDto };
      inputWithKyberKeys.keys = {
        ecc: {
          ...eccKey.toJSON(),
        },
        kyber: {
          ...kyberKey.toJSON(),
        },
      };

      jest.spyOn(keyServerUseCases, 'parseKeysInput').mockReturnValueOnce({
        ecc: eccKey.toJSON(),
        kyber: kyberKey.toJSON(),
      });

      jest
        .spyOn(userUseCases, 'loginAccess')
        .mockResolvedValueOnce(mockLoginResult);

      jest
        .spyOn(featureLimitService, 'canUserAccessPlatform')
        .mockResolvedValueOnce(true);

      await authController.cliLoginAccess(inputWithKyberKeys, ClientEnum.Cli);

      expect(userUseCases.loginAccess).toHaveBeenCalledWith({
        ...inputWithKyberKeys,
        keys: {
          ecc: {
            ...eccKey.toJSON(),
          },
          kyber: {
            ...kyberKey.toJSON(),
          },
        },
        platform: PlatformName.CLI,
      });
    });
  });
});
