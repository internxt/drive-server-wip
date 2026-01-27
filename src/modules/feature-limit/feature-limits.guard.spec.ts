import { createMock } from '@golevelup/ts-jest';
import { TestingModule, Test } from '@nestjs/testing';
import { PaymentRequiredException } from './exceptions/payment-required.exception';
import { FeatureLimitUsecases } from './feature-limit.usecase';
import { newUser } from '../../../test/fixtures';
import { LimitLabels } from './limits.enum';
import { BadRequestException, ExecutionContext, Logger } from '@nestjs/common';
import { FeatureLimit } from './feature-limits.guard';
import { Reflector } from '@nestjs/core';
import {
  ApplyLimitMetadata,
  FEATURE_LIMIT_KEY,
} from './decorators/apply-limit.decorator';

const user = newUser();

describe('FeatureLimitUsecases', () => {
  let guard: FeatureLimit;
  let reflector: Reflector;
  let featureLimitUsecases: FeatureLimitUsecases;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeatureLimit],
    })
      .useMocker(() => createMock())
      .setLogger(createMock<Logger>())
      .compile();

    guard = module.get<FeatureLimit>(FeatureLimit);
    featureLimitUsecases =
      module.get<FeatureLimitUsecases>(FeatureLimitUsecases);
    reflector = module.get<Reflector>(Reflector);
  });

  it('Guard should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('When metadata is missing, it should throw', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);

    const context = createMockExecutionContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('When a data source is missing in the incoming request, it should throw', async () => {
    mockMetadata(reflector, {
      limitLabels: ['' as LimitLabels],
      dataSources: [{ sourceKey: 'body', fieldName: 'itemId' }],
    });

    const context = createMockExecutionContext({
      user,
      body: {},
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('When limit should not be enforced, it should allow access', async () => {
    mockMetadata(reflector, {
      limitLabels: ['' as LimitLabels],
      dataSources: [{ sourceKey: 'body', fieldName: 'itemId' }],
    });
    jest.spyOn(featureLimitUsecases, 'enforceLimit').mockResolvedValue(false);

    const context = createMockExecutionContext({
      user,
      body: { itemId: 'item-1' },
    });

    await expect(guard.canActivate(context)).resolves.toBeTruthy();
  });

  it('When two labels are passed, it should check two limits', async () => {
    const limitLabels = [
      'firstLabel' as LimitLabels,
      'secondLabel' as LimitLabels,
    ];
    mockMetadata(reflector, {
      limitLabels,
      dataSources: [{ sourceKey: 'body', fieldName: 'itemId' }],
    });
    const enforceLimitSpy = jest.spyOn(featureLimitUsecases, 'enforceLimit');
    enforceLimitSpy.mockResolvedValue(false);
    const context = createMockExecutionContext({
      user,
      body: { itemId: 'item-1' },
    });

    await guard.canActivate(context);

    expect(enforceLimitSpy).toHaveBeenNthCalledWith(1, limitLabels[0], user, {
      itemId: 'item-1',
    });
    expect(enforceLimitSpy).toHaveBeenNthCalledWith(2, limitLabels[1], user, {
      itemId: 'item-1',
    });
  });

  it('When two or more limits are checked and one throws, it should propagate the error', async () => {
    const limitLabels = [
      'firstLabel' as LimitLabels,
      'secondLabel' as LimitLabels,
      'thirdLabel' as LimitLabels,
    ];
    mockMetadata(reflector, {
      limitLabels,
      dataSources: [{ sourceKey: 'body', fieldName: 'itemId' }],
    });

    jest
      .spyOn(featureLimitUsecases, 'enforceLimit')
      .mockResolvedValueOnce(false);
    jest
      .spyOn(featureLimitUsecases, 'enforceLimit')
      .mockRejectedValueOnce(new PaymentRequiredException());

    const context = createMockExecutionContext({
      user,
      body: { itemId: 'item-1' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      PaymentRequiredException,
    );
  });
});

const createMockExecutionContext = (requestData: any): ExecutionContext => {
  return {
    getHandler: () => ({
      name: 'endPointHandler',
    }),
    switchToHttp: () => ({
      getRequest: () => requestData,
    }),
  } as unknown as ExecutionContext;
};

const mockMetadata = (reflector: Reflector, metadata: ApplyLimitMetadata) => {
  jest.spyOn(reflector, 'get').mockImplementation((key) => {
    if (key === FEATURE_LIMIT_KEY) {
      return metadata;
    }
  });
};
