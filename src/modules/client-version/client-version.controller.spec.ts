import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import { BadRequestException } from '@nestjs/common';
import * as asyncLocalStorage from '../../common/async-local-storage/async-local-storage';
import { ClientEnum } from '../../common/enums/platform.enum';
import { ClientVersionStatus } from './client-version-policy.domain';
import { ClientVersionController } from './client-version.controller';
import { type ClientVersionUseCase } from './client-version.usecase';

describe('GET /clients/compatibility', () => {
  let controller: ClientVersionController;
  let clientVersionUseCase: DeepMocked<ClientVersionUseCase>;

  beforeEach(() => {
    clientVersionUseCase = createMock<ClientVersionUseCase>();
    controller = new ClientVersionController(clientVersionUseCase);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('When the app sends its name and version, then its compatibility is returned', () => {
    jest.spyOn(asyncLocalStorage, 'getAsyncLocalStorage').mockReturnValue({
      client: ClientEnum.Cli,
      version: '1.0.0',
    });
    const compatibility = {
      status: ClientVersionStatus.Unsupported,
      message: 'message',
      recommendedVersion: '2.8.1',
      sunsetAt: null,
    };
    clientVersionUseCase.getCompatibility.mockReturnValue(compatibility);

    const response = controller.getCompatibility();

    expect(response).toEqual(compatibility);
    expect(clientVersionUseCase.getCompatibility).toHaveBeenCalledWith(
      ClientEnum.Cli,
      '1.0.0',
    );
  });

  it('When the app does not send a valid name and version, then it is a bad request', () => {
    jest.spyOn(asyncLocalStorage, 'getAsyncLocalStorage').mockReturnValue({
      client: ClientEnum.Cli,
      version: null,
    });

    expect(() => controller.getCompatibility()).toThrow(BadRequestException);
  });
});
