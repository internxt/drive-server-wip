import { Test, type TestingModule } from '@nestjs/testing';
import { FuzzySearchUseCases } from './fuzzy-search.usecase';
import { createMock } from '@golevelup/ts-jest';
import { newUser, newWorkspace } from '../../../test/fixtures';
import { SequelizeLookUpRepository } from './look-up.repository';

describe('FuzzySearchUseCases', () => {
  let service: FuzzySearchUseCases;
  let fuzzySearchRepository: SequelizeLookUpRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FuzzySearchUseCases],
    })
      .useMocker(createMock)
      .compile();

    service = module.get<FuzzySearchUseCases>(FuzzySearchUseCases);
    fuzzySearchRepository = module.get<SequelizeLookUpRepository>(
      SequelizeLookUpRepository,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('workspaceFuzzySearch', () => {
    it('should call repository.workspaceSearch', async () => {
      const user = newUser();
      const workspace = newWorkspace();
      const search = 'search';
      jest
        .spyOn(fuzzySearchRepository, 'workspaceSearch')
        .mockResolvedValueOnce([]);

      await service.workspaceFuzzySearch(user.uuid, workspace, search);

      expect(fuzzySearchRepository.workspaceSearch).toHaveBeenCalledWith(
        user.uuid,
        workspace.workspaceUserId,
        workspace.id,
        search,
        0,
      );
    });
  });
});
