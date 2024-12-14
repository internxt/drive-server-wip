import { Test, TestingModule } from '@nestjs/testing';
import { SequelizeUsageRepository } from './usage.repository';
import { UsageModel } from './usage.model';
import { getModelToken } from '@nestjs/sequelize';
import { createMock } from '@golevelup/ts-jest';
import { Usage, UsageType } from './usage.domain';
import { newUsage, newUser } from '../../../test/fixtures';

const mockUsageInstance = (usageData): Partial<UsageModel> => ({
  ...usageData,
  toJSON: jest.fn().mockReturnValue(usageData),
});

const mockedUser = newUser();
const mockSequelizeQuery = jest.fn();

describe('SequelizeUsageRepository', () => {
  let repository: SequelizeUsageRepository;
  let usageModel: typeof UsageModel;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequelizeUsageRepository],
    })
      .useMocker((token) => {
        if (token === getModelToken(UsageModel)) {
          return {
            findAll: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            sequelize: {
              query: mockSequelizeQuery,
            },
          };
        }
        return createMock();
      })
      .compile();

    repository = module.get<SequelizeUsageRepository>(SequelizeUsageRepository);
    usageModel = module.get<typeof UsageModel>(getModelToken(UsageModel));
  });

  describe('getUserUsages', () => {
    it('When usages are found for a user, it should return successfully', async () => {
      const mockUsages = [
        mockUsageInstance(newUsage()),
        mockUsageInstance(newUsage()),
      ];
      jest
        .spyOn(usageModel, 'findAll')
        .mockResolvedValueOnce(mockUsages as any);

      const result = await repository.getUserUsages(mockedUser.uuid);

      expect(result).toHaveLength(mockUsages.length);
      expect(result[0]).toBeInstanceOf(Usage);
    });

    it('When no usages are found for a user, it should return nothing', async () => {
      jest.spyOn(usageModel, 'findAll').mockResolvedValueOnce([]);

      const result = await repository.getUserUsages(mockedUser.uuid);

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('When usage is created, it should return successfully', async () => {
      const usage = newUsage();
      const mockUsage = mockUsageInstance(usage);
      jest.spyOn(usageModel, 'create').mockResolvedValueOnce(mockUsage as any);

      const result = await repository.create(usage);

      expect(result).toBeInstanceOf(Usage);
      expect(result.id).toEqual(mockUsage.id);
    });
  });

  describe('getMostRecentMonthlyOrYearlyUsage', () => {
    it('When the most recent monthly or yearly usage exists, it should return successfully', async () => {
      const mockUsage = mockUsageInstance(
        newUsage({ attributes: { type: UsageType.Monthly } }),
      );
      jest.spyOn(usageModel, 'findOne').mockResolvedValueOnce(mockUsage as any);

      const result = await repository.getMostRecentMonthlyOrYearlyUsage(
        mockedUser.uuid,
      );

      expect(result).toBeInstanceOf(Usage);
      expect(result.type).toBe(UsageType.Monthly);
    });

    it('When no recent monthly or yearly usage exists, it should return nothing', async () => {
      jest.spyOn(usageModel, 'findOne').mockResolvedValueOnce(null);

      const result = await repository.getMostRecentMonthlyOrYearlyUsage(
        mockedUser.uuid,
      );

      expect(result).toBeNull();
    });
  });

  describe('getUsage', () => {
    it('When a usage is found, it should return successfully', async () => {
      const mockUsage = mockUsageInstance(newUsage());
      jest.spyOn(usageModel, 'findOne').mockResolvedValueOnce(mockUsage as any);

      const result = await repository.getUsage({ type: UsageType.Daily });

      expect(result).toBeInstanceOf(Usage);
      expect(result.type).toBe(UsageType.Daily);
    });

    it('When no usage is found, it should return null', async () => {
      jest.spyOn(usageModel, 'findOne').mockResolvedValueOnce(null);

      const result = await repository.getUsage({ type: UsageType.Daily });

      expect(result).toBeNull();
      expect(usageModel.findOne).toHaveBeenCalledWith({
        where: { type: UsageType.Daily },
        order: undefined,
      });
    });
  });

  describe('getUserUsage', () => {
    it('When user usage is requested, it should return the aggregated totals', async () => {
      mockSequelizeQuery.mockResolvedValueOnce([
        [
          {
            total_yearly_delta: 500,
            total_monthly_delta: 200,
          },
        ],
      ]);

      const result = await repository.getUserUsage(mockedUser.uuid);

      expect(mockSequelizeQuery).toHaveBeenCalledWith(expect.any(String), {
        replacements: { userUuid: mockedUser.uuid },
      });
      expect(result).toEqual({
        total_yearly_delta: 500,
        total_monthly_delta: 200,
      });
    });
  });
});
