import { AuthController } from './auth.controller';
import { UserUseCases } from '../user/user.usecase';
import { CryptoService } from '../../externals/crypto/crypto.service';

import {
  LoginAccessOpaqueFinishDto,
  LoginAccessOpaqueStartDto,
} from './dto/login-access.dto';
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
    it('Should sucessfully finish both phases of the login', async () => {
      const email = 'USER_test@gmail.com';
      const password = v4();
      const { startLoginRequest, clientLoginState } = opaque.client.startLogin({
        password,
      });
      const { clientRegistrationState, registrationRequest } =
        opaque.client.startRegistration({ password });
      const { registrationResponse } = opaque.server.createRegistrationResponse(
        {
          serverSetup: serverSetupMock,
          userIdentifier: email.toLowerCase(),
          registrationRequest,
        },
      );
      const { registrationRecord: registrationRecordMock } =
        opaque.client.finishRegistration({
          clientRegistrationState,
          registrationResponse,
          password,
        });
      const loginOpaqueDto = new LoginAccessOpaqueStartDto();
      loginOpaqueDto.email = email;
      loginOpaqueDto.startLoginRequest = startLoginRequest;

      jest.spyOn(userUseCases, 'findByEmail').mockResolvedValue({
        registrationRecord: registrationRecordMock,
      } as any);
      const startLoginOpaqueSpy = jest.spyOn(cryptoService, 'startLoginOpaque');
      const resultPhaseOne =
        await authController.loginOpaqueStart(loginOpaqueDto);
      const serverLoginStateValue = userUseCases.setLoginState.mock.calls[0][1];

      expect(startLoginOpaqueSpy).toHaveBeenCalledTimes(1);
      expect(startLoginOpaqueSpy).toHaveBeenCalledWith(
        loginOpaqueDto.email.toLowerCase(),
        registrationRecordMock,
        loginOpaqueDto.startLoginRequest,
      );
      expect(resultPhaseOne.loginResponse).toBeDefined();
      expect(resultPhaseOne).toEqual({ loginResponse: expect.any(String) });

      const loginOpaqueFinishDto = new LoginAccessOpaqueFinishDto();
      loginOpaqueFinishDto.email = email;

      jest
        .spyOn(userUseCases, 'getLoginState')
        .mockResolvedValue(serverLoginStateValue);

      const { finishLoginRequest, sessionKey } = opaque.client.finishLogin({
        clientLoginState,
        loginResponse: resultPhaseOne.loginResponse,
        password,
      });

      loginOpaqueFinishDto.finishLoginRequest = finishLoginRequest;

      const finishLoginOpaqueSpy = jest.spyOn(
        cryptoService,
        'finishLoginOpaque',
      );

      const resultPhaseTwo =
        await authController.loginOpaqueFinish(loginOpaqueFinishDto);

      expect(finishLoginOpaqueSpy).toHaveBeenCalledTimes(1);
      expect(finishLoginOpaqueSpy).toHaveBeenCalledWith(
        finishLoginRequest,
        serverLoginStateValue,
      );

      expect(resultPhaseTwo.user).toBeDefined();
      expect(resultPhaseTwo.token).toBeDefined();
      expect(resultPhaseTwo.sessionID).toBeDefined();
      expect(userUseCases.setSessionKey).toHaveBeenCalledWith(
        resultPhaseTwo.sessionID,
        sessionKey,
      );
    });
  });
});
