import { type Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type DeepMocked, createMock } from '@golevelup/ts-jest';
import { newUser } from '../../../test/fixtures';
import { FeatureLimitController } from './feature-limit.controller';
import { FeatureLimitUsecases } from './feature-limit.usecase';

describe('FeatureLimitController', () => {
  let controller: FeatureLimitController;
  let featureLimitUsecases: DeepMocked<FeatureLimitUsecases>;

  const user = newUser();

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FeatureLimitController],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();

    controller = moduleRef.get(FeatureLimitController);
    featureLimitUsecases = moduleRef.get(FeatureLimitUsecases);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /feature-limits', () => {
    it('When called, then it returns the user feature limits', async () => {
      const limits = { maxUploadFileSize: 1073741824 };
      featureLimitUsecases.getUserFeatureLimits.mockResolvedValueOnce(limits);

      const result = await controller.getFeatureLimits(user);

      expect(result).toEqual(limits);
      expect(featureLimitUsecases.getUserFeatureLimits).toHaveBeenCalledWith(
        user,
      );
    });
  });
});
