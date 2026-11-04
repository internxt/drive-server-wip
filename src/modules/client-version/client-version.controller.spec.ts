import { createMock } from '@golevelup/ts-jest';
import { BadRequestException } from '@nestjs/common';
import * as asyncLocalStorage from '../../common/async-local-storage/async-local-storage';
import { ClientEnum } from '../../common/enums/platform.enum';
import { ClientVersionStatus } from './client-version-policy.domain';
import { ClientVersionController } from './client-version.controller';
import { type ClientVersionUseCase } from './client-version.usecase';

describe('GET /clients/compatibility', () => {
  const clientVersionUseCase = createMock<ClientVersionUseCase>();
  const controller = new ClientVersionController(clientVersionUseCase);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('When the app sends its name and version, then its compatibility is returned', () => {
    const compatibility = {
      status: ClientVersionStatus.UpToDate,
      message: null,
      recommendedVersion: null,
      sunsetAt: null,
    };
    jest
      .spyOn(asyncLocalStorage, 'getAsyncLocalStorage')
      .mockReturnValue({ client: ClientEnum.Cli, version: '1.0.0' });
    clientVersionUseCase.getCompatibility.mockReturnValue(compatibility);

    const response = controller.getCompatibility();

    expect(response).toEqual(compatibility);
  });

  it.each([[undefined], [{ client: ClientEnum.Cli, version: null }]])(
    'When the app does not send its name and version, then it throws',
    (store) => {
      jest
        .spyOn(asyncLocalStorage, 'getAsyncLocalStorage')
        .mockReturnValue(store);

      expect(() => controller.getCompatibility()).toThrow(BadRequestException);
    },
  );
});
