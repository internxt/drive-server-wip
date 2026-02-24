import { Test } from '@nestjs/testing';
import { type DeepMocked, createMock } from '@golevelup/ts-jest';
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
  let limitModel: DeepMocked<typeof Limitmodel>;

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
    limitModel = moduleRef.get(getModelToken(Limitmodel));
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

  describe('findAllUserOverriddenLimits', () => {
    it('When user has multiple overridden limits, then it should return limits', async () => {
      const userId = v4();
      const mockUserOverriddenLimit1 = createMock<UserOverriddenLimitModel>({
        limit: createMock<Limitmodel>(),
      });
      const mockUserOverriddenLimit2 = createMock<UserOverriddenLimitModel>({
        limit: createMock<Limitmodel>(),
      });

      userOverriddenLimitModel.findAll.mockResolvedValueOnce([
        mockUserOverriddenLimit1,
        mockUserOverriddenLimit2,
      ]);

      const result = await repository.findAllUserOverriddenLimits(userId);

      expect(userOverriddenLimitModel.findAll).toHaveBeenCalledWith({
        where: { userId },
        include: [{ model: Limitmodel, required: true }],
      });
      expect(result[0]).toBeInstanceOf(Limit);
      expect(result[1]).toBeInstanceOf(Limit);
    });
  });

  describe('findLimitByLabelAndValue', () => {
    it('When limit is found by label and value, then it should return the Limit domain object', async () => {
      const mockLimitAttributes = createMock<Limitmodel>({
        id: v4(),
        label: LimitLabels.CliAccess,
        type: LimitTypes.Boolean,
        value: 'true',
      });

      limitModel.findOne.mockResolvedValueOnce(mockLimitAttributes);

      const result = await repository.findLimitByLabelAndValue(
        mockLimitAttributes.label,
        mockLimitAttributes.value,
      );

      expect(limitModel.findOne).toHaveBeenCalledWith({
        where: {
          label: mockLimitAttributes.label,
          value: mockLimitAttributes.value,
        },
      });
      expect(result).toBeInstanceOf(Limit);
      expect(result?.label).toBe(mockLimitAttributes.label);
      expect(result?.value).toBe(mockLimitAttributes.value);
    });

    it('When limit is not found by label and value, then it should return null', async () => {
      const label = LimitLabels.MaxSharedItems;
      const value = '100';

      limitModel.findOne.mockResolvedValueOnce(null);

      const result = await repository.findLimitByLabelAndValue(label, value);

      expect(limitModel.findOne).toHaveBeenCalledWith({
        where: { label, value },
      });
      expect(result).toBeNull();
    });
  });
});
