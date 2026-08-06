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

  describe('fuzzySearch', () => {
    test('When an offset is passed, then it should be forwarded to the repository', async () => {
      const user = newUser();
      const search = 'search';
      jest.spyOn(fuzzySearchRepository, 'search').mockResolvedValueOnce([]);

      await service.fuzzySearch(user.uuid, search, 20);

      expect(fuzzySearchRepository.search).toHaveBeenCalledWith(
        user.uuid,
        search,
        20,
      );
    });
  });

  describe('workspaceFuzzySearchWithFilters', () => {
    test('When filters are passed, then they should be forwarded to the repository', async () => {
      const user = newUser();
      const workspace = newWorkspace();
      const search = 'search';
      jest
        .spyOn(fuzzySearchRepository, 'workspaceSearchWithFilters')
        .mockResolvedValueOnce([]);

      await service.workspaceFuzzySearchWithFilters(
        user.uuid,
        workspace,
        search,
        { type: ['pdf'] },
      );

      expect(
        fuzzySearchRepository.workspaceSearchWithFilters,
      ).toHaveBeenCalledWith(
        user.uuid,
        workspace.workspaceUserId,
        workspace.id,
        search,
        expect.objectContaining({ itemTypes: ['file'], extensions: ['pdf'] }),
      );
    });
  });

  describe('fuzzySearchWithFilters', () => {
    const user = newUser();
    const search = 'search';

    beforeEach(() => {
      jest
        .spyOn(fuzzySearchRepository, 'searchWithFilters')
        .mockResolvedValue([]);
    });

    test('When no query is passed, then it should search without filters', async () => {
      await service.fuzzySearchWithFilters(user.uuid, search);

      expect(fuzzySearchRepository.searchWithFilters).toHaveBeenCalledWith(
        user.uuid,
        search,
        { offset: 0 },
      );
    });

    test('When file extensions are passed, then it should forward them and only include files', async () => {
      await service.fuzzySearchWithFilters(user.uuid, search, {
        type: ['pdf'],
      });

      expect(fuzzySearchRepository.searchWithFilters).toHaveBeenCalledWith(
        user.uuid,
        search,
        expect.objectContaining({
          itemTypes: ['file'],
          extensions: ['pdf'],
        }),
      );
    });

    test('When the folder type is passed alone, then it should only include folders without extensions', async () => {
      await service.fuzzySearchWithFilters(user.uuid, search, {
        type: ['folder'],
      });

      expect(fuzzySearchRepository.searchWithFilters).toHaveBeenCalledWith(
        user.uuid,
        search,
        expect.objectContaining({ itemTypes: ['folder'] }),
      );
      const filters = (fuzzySearchRepository.searchWithFilters as jest.Mock)
        .mock.calls[0][2];
      expect(filters.extensions).toBeUndefined();
    });

    test('When the folder type and file extensions are combined, then it should include both item types', async () => {
      await service.fuzzySearchWithFilters(user.uuid, search, {
        type: ['folder', 'jpg', 'png'],
      });

      expect(fuzzySearchRepository.searchWithFilters).toHaveBeenCalledWith(
        user.uuid,
        search,
        expect.objectContaining({
          itemTypes: ['folder', 'file'],
          extensions: ['jpg', 'png'],
        }),
      );
    });

    test('When duplicated extensions are passed, then they should be deduplicated', async () => {
      await service.fuzzySearchWithFilters(user.uuid, search, {
        type: ['ogg', 'mp3', 'ogg'],
      });

      const filters = (fuzzySearchRepository.searchWithFilters as jest.Mock)
        .mock.calls[0][2];
      expect(filters.extensions).toEqual(['ogg', 'mp3']);
    });

    test('When size and date filters are passed, then they should be forwarded to the repository', async () => {
      await service.fuzzySearchWithFilters(user.uuid, search, {
        offset: 20,
        minSize: 1024,
        maxSize: 5242880,
        modifiedAfter: '2026-01-01T00:00:00.000Z',
        modifiedBefore: '2026-06-30T23:59:59.999Z',
      });

      expect(fuzzySearchRepository.searchWithFilters).toHaveBeenCalledWith(
        user.uuid,
        search,
        {
          offset: 20,
          minSize: 1024,
          maxSize: 5242880,
          modifiedAfter: '2026-01-01T00:00:00.000Z',
          modifiedBefore: '2026-06-30T23:59:59.999Z',
        },
      );
    });
  });
});
