import { Test } from '@nestjs/testing';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { SequelizeFeatureLimitsRepository } from './feature-limit.repository';
import { UserOverriddenLimitModel } from './models/user-overridden-limit.model';
import { Limitmodel } from './models/limit.model';
import { LimitLabels, LimitTypes } from './limits.enum';
import { Limit } from './domain/limit.domain';
import { v4 } from 'uuid';
import { getModelToken } from '@nestjs/sequelize';

describe('SequelizeFeatureLimitsRepository', () => {
  let repository: SequelizeFeatureLimitsRepository;
  let userOverriddenLimitModel: DeepMocked<typeof UserOverriddenLimitModel>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [SequelizeFeatureLimitsRepository],
    })
      .useMocker(() => createMock())
      .compile();

    repository = moduleRef.get<SequelizeFeatureLimitsRepository>(
      SequelizeFeatureLimitsRepository,
    );
    userOverriddenLimitModel = moduleRef.get(
      getModelToken(UserOverriddenLimitModel),
    );
  });

  describe('findUserOverriddenLimit', () => {
    it('When user override exists, then it should return correct Limit', async () => {
      const userId = v4();
      const limitLabel = LimitLabels.CliAccess;
      const mockLimitAttributes = {
        id: v4(),
        label: limitLabel,
        type: LimitTypes.Boolean,
        value: 'true',
      };
      const mockUserOverriddenLimit = createMock<UserOverriddenLimitModel>({
        id: v4(),
        userId,
        limitId: mockLimitAttributes.id,
        limit: mockLimitAttributes,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      userOverriddenLimitModel.findOne.mockResolvedValueOnce(
        mockUserOverriddenLimit,
      );

      const result = await repository.findUserOverriddenLimit(
        userId,
        limitLabel,
      );

      expect(userOverriddenLimitModel.findOne).toHaveBeenCalledWith({
        where: { userId },
        include: [
          {
            model: Limitmodel,
            where: { label: limitLabel },
            required: true,
          },
        ],
      });
      expect(result).toBeInstanceOf(Limit);
      expect(result?.type).toBe(LimitTypes.Boolean);
      expect(result?.value).toBe(mockLimitAttributes.value);
    });
  });
});
