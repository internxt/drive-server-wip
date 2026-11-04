jest.mock('newrelic', () => ({ addCustomAttributes: jest.fn() }));

import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { type Reflector } from '@nestjs/core';
import newrelic from 'newrelic';
import * as asyncLocalStorage from '../../common/async-local-storage/async-local-storage';
import { ClientEnum } from '../../common/enums/platform.enum';
import { ClientVersionStatus } from './client-version-policy.domain';
import { ClientVersionGuard } from './client-version.guard';
import { type ClientVersionUseCase } from './client-version.usecase';

const compatibilityWith = (status: ClientVersionStatus) => ({
  status,
  message: 'message',
  recommendedVersion: '2.8.1',
  sunsetAt: null,
});

describe('ClientVersionGuard', () => {
  let guard: ClientVersionGuard;
  let reflector: DeepMocked<Reflector>;
  let clientVersionUseCase: DeepMocked<ClientVersionUseCase>;
  const context = createMock<ExecutionContext>();

  beforeEach(() => {
    reflector = createMock<Reflector>();
    reflector.getAllAndOverride.mockReturnValue(undefined);
    clientVersionUseCase = createMock<ClientVersionUseCase>();
    guard = new ClientVersionGuard(reflector, clientVersionUseCase);
    jest.spyOn(asyncLocalStorage, 'getAsyncLocalStorage').mockReturnValue({
      client: ClientEnum.Cli,
      version: '1.0.0',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('When the app version is unsupported, then the blocked request is reported', () => {
    clientVersionUseCase.getCompatibility.mockReturnValue(
      compatibilityWith(ClientVersionStatus.Unsupported),
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);

    expect(newrelic.addCustomAttributes).toHaveBeenCalledWith({
      internxtClient: ClientEnum.Cli,
      internxtVersion: '1.0.0',
      errorCode: 'CLIENT_VERSION_UNSUPPORTED',
    });
  });

  it('When the app version is allowed, then nothing is reported', () => {
    clientVersionUseCase.getCompatibility.mockReturnValue(
      compatibilityWith(ClientVersionStatus.Deprecated),
    );

    guard.canActivate(context);

    expect(newrelic.addCustomAttributes).not.toHaveBeenCalled();
  });

  it('When the app version is unsupported, then access is denied with the update details', () => {
    clientVersionUseCase.getCompatibility.mockReturnValue(
      compatibilityWith(ClientVersionStatus.Unsupported),
    );

    let thrown: ForbiddenException;
    try {
      guard.canActivate(context);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ForbiddenException);
    expect(thrown.getResponse()).toEqual({
      message: 'message',
      error: 'Forbidden',
      statusCode: 403,
      errorCode: 'CLIENT_VERSION_UNSUPPORTED',
      recommendedVersion: '2.8.1',
    });
  });

  it.each([
    ClientVersionStatus.UpToDate,
    ClientVersionStatus.UpdateRecommended,
    ClientVersionStatus.Deprecated,
  ])('When the app version is %s, then the request is allowed', (status) => {
    clientVersionUseCase.getCompatibility.mockReturnValue(
      compatibilityWith(status),
    );

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it.each([
    ['is not a known app', { client: null, version: '1.0.0' }],
    [
      'does not send a valid version',
      { client: ClientEnum.Cli, version: null },
    ],
  ])('When the app %s, then the request is allowed', (_, storage) => {
    jest
      .spyOn(asyncLocalStorage, 'getAsyncLocalStorage')
      .mockReturnValue(storage);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(clientVersionUseCase.getCompatibility).not.toHaveBeenCalled();
  });

  it('When the endpoint skips the version check, then the version is not checked', () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(clientVersionUseCase.getCompatibility).not.toHaveBeenCalled();
  });
});
