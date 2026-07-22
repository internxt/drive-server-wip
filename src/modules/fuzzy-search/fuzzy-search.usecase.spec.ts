import { Test, type TestingModule } from '@nestjs/testing';
import { FuzzySearchUseCases } from './fuzzy-search.usecase';
import { createMock } from '@golevelup/ts-jest';
import { newUser, newWorkspace } from '../../../test/fixtures';
import { SequelizeLookUpRepository } from './look-up.repository';
import { FileCategory } from './file-categories';

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
        { offset: 0 },
      );
    });
  });

  describe('fuzzySearch', () => {
    const user = newUser();
    const search = 'search';

    beforeEach(() => {
      jest.spyOn(fuzzySearchRepository, 'search').mockResolvedValue([]);
    });

    test('When no query is passed, then it should search without filters', async () => {
      await service.fuzzySearch(user.uuid, search);

      expect(fuzzySearchRepository.search).toHaveBeenCalledWith(
        user.uuid,
        search,
        { offset: 0 },
      );
    });

    test('When a file category is passed, then it should resolve it to extensions and only include files', async () => {
      await service.fuzzySearch(user.uuid, search, {
        type: [FileCategory.Pdf],
      });

      expect(fuzzySearchRepository.search).toHaveBeenCalledWith(
        user.uuid,
        search,
        expect.objectContaining({
          itemTypes: ['file'],
          extensions: ['pdf'],
        }),
      );
    });

    test('When the folder category is passed alone, then it should only include folders without extensions', async () => {
      await service.fuzzySearch(user.uuid, search, {
        type: [FileCategory.Folder],
      });

      expect(fuzzySearchRepository.search).toHaveBeenCalledWith(
        user.uuid,
        search,
        expect.objectContaining({ itemTypes: ['folder'] }),
      );
      const filters = (fuzzySearchRepository.search as jest.Mock).mock
        .calls[0][2];
      expect(filters.extensions).toBeUndefined();
    });

    test('When folder and file categories are combined, then it should include both item types', async () => {
      await service.fuzzySearch(user.uuid, search, {
        type: [FileCategory.Folder, FileCategory.Image],
      });

      expect(fuzzySearchRepository.search).toHaveBeenCalledWith(
        user.uuid,
        search,
        expect.objectContaining({
          itemTypes: ['folder', 'file'],
          extensions: expect.arrayContaining(['jpg', 'png']),
        }),
      );
    });

    test('When overlapping categories are passed, then extensions should be deduplicated', async () => {
      await service.fuzzySearch(user.uuid, search, {
        type: [FileCategory.Audio, FileCategory.Video],
      });

      const filters = (fuzzySearchRepository.search as jest.Mock).mock
        .calls[0][2];
      const oggOccurrences = filters.extensions.filter(
        (extension: string) => extension === 'ogg',
      );
      expect(oggOccurrences).toHaveLength(1);
    });

    test('When size and date filters are passed, then they should be forwarded to the repository', async () => {
      await service.fuzzySearch(user.uuid, search, {
        offset: 20,
        minSize: 1024,
        maxSize: 5242880,
        modifiedAfter: '2026-01-01T00:00:00.000Z',
        modifiedBefore: '2026-06-30T23:59:59.999Z',
      });

      expect(fuzzySearchRepository.search).toHaveBeenCalledWith(
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
