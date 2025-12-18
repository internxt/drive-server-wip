import { AuthController } from './auth.controller';
import { UserUseCases } from '../user/user.usecase';
import { CryptoService } from '../../externals/crypto/crypto.service';

import { LoginAccessOpaqueStartDto } from './dto/login-access.dto';
import { Logger } from '@nestjs/common';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { v4 } from 'uuid';

import { Test } from '@nestjs/testing';
import * as opaque from '@serenity-kit/opaque';
import { ConfigService } from '@nestjs/config';

describe('AuthController', () => {
  let authController: AuthController;
  let userUseCases: DeepMocked<UserUseCases>;
  let cryptoService: DeepMocked<CryptoService>;

  let serverSetupMock: string;

  beforeAll(async () => {
    serverSetupMock = opaque.server.createSetup();
  });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        CryptoService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'secrets.serverSetup') return serverSetupMock;
              if (key === 'secrets.cryptoSecret2') return 'a'.repeat(64); // Valid hex key
              if (key === 'secrets.cryptoSecret') return 'b'.repeat(64); // Valid hex key
              return null;
            },
          },
        },
      ],
    })
      .setLogger(createMock<Logger>())
      .useMocker((token) => {
        if (token === CryptoService || token === ConfigService) {
          return undefined;
        }
        return createMock();
      })
      .compile();

    authController = moduleRef.get(AuthController);
    userUseCases = moduleRef.get(UserUseCases);
    cryptoService = moduleRef.get(CryptoService);
  });

  describe('POST /login-opaque', () => {
    it('Should sucessfully finish 1st phase of the login', async () => {
      jest
        .spyOn(cryptoService['configService'], 'get')
        .mockReturnValue(serverSetupMock);
      const loginOpaqueDto = new LoginAccessOpaqueStartDto();
      loginOpaqueDto.email = 'USER_test@gmail.com';
      const password = v4();
      const { startLoginRequest } = opaque.client.startLogin({
        password,
      });
      loginOpaqueDto.startLoginRequest = startLoginRequest;
      const { clientRegistrationState, registrationRequest } =
        opaque.client.startRegistration({ password });
      const { registrationResponse } = opaque.server.createRegistrationResponse(
        {
          serverSetup: serverSetupMock,
          userIdentifier: loginOpaqueDto.email.toLowerCase(),
          registrationRequest,
        },
      );
      const { registrationRecord: registrationRecordMock } =
        opaque.client.finishRegistration({
          clientRegistrationState,
          registrationResponse,
          password,
        });
      jest.spyOn(userUseCases, 'findByEmail').mockResolvedValueOnce({
        registrationRecord: registrationRecordMock,
      } as any);
      const startLoginOpaqueSpy = jest.spyOn(cryptoService, 'startLoginOpaque');

      const result = await authController.loginOpaqueStart(loginOpaqueDto);

      expect(startLoginOpaqueSpy).toHaveBeenCalledTimes(1);
      expect(startLoginOpaqueSpy).toHaveBeenCalledWith(
        loginOpaqueDto.email.toLowerCase(),
        registrationRecordMock,
        loginOpaqueDto.startLoginRequest,
      );

      expect(result.loginResponse).toBeDefined();
      expect(result).toEqual({ loginResponse: expect.any(String) });
      expect(typeof result.loginResponse).toBe('string');
    });
  });
});
