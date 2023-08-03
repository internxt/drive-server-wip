import { Test, TestingModule } from '@nestjs/testing';
import { Keys, KeyServer } from './key-server.domain';
import { SequelizeKeyServerRepository } from './key-server.repository';
import { KeyServerUseCases } from './key-server.usecase';

describe('Key Server Use Cases', () => {
  let service: KeyServerUseCases;
  let keyServerRepository: SequelizeKeyServerRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeyServerUseCases,
        SequelizeKeyServerRepository,
        {
          provide: SequelizeKeyServerRepository,
          useValue: {
            findUserKeysOrCreate: () => {
              return {};
            },
          },
        },
      ],
    }).compile();

    service = module.get<KeyServerUseCases>(KeyServerUseCases);

    keyServerRepository = module.get<SequelizeKeyServerRepository>(
      SequelizeKeyServerRepository,
    );
  });

  it('is be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Add Keys To User', () => {
    it('saves the keys to the user', async () => {
      const userId = 234059;
      const keys: Keys = {
        privateKey:
          'gMWcRQZTAnrLMlFgAfGyukRICiLBKFqndsuEzMKuJuPlHlhbyVxPDxuWeZpI',
        publicKey:
          'lSWpfeTYwKqrMmfmTgqjQmInalzEDSrMRCNOOVOsrTuGWlbfMTThJHEBPmcV',
        revocationKey:
          'WtPCEiOBbBTKIcOsePFyUCwCbfFmuoJsZKHnuKnjMbvWSPJxOdDFtaNRvwCB',
      };

      const keyServer = new KeyServer({
        id: 430,
        userId,
        ...keys,
        encryptVersion: '',
      });

      jest
        .spyOn(keyServerRepository, 'findUserKeysOrCreate')
        .mockResolvedValue([keyServer, true]);

      await service.addKeysToUser(userId, keys);

      expect(keyServerRepository.findUserKeysOrCreate).toBeCalledTimes(1);
      expect(keyServerRepository.findUserKeysOrCreate).toHaveBeenCalledWith(
        userId,
        {
          userId,
          ...keys,
          encryptVersion: null,
        },
      );
    });

    const incompleteKeys = [
      {
        privateKey:
          'gMWcRQZTAnrLMlFgAfGyukRICiLBKFqndsuEzMKuJuPlHlhbyVxPDxuWeZpI',
        publicKey:
          'lSWpfeTYwKqrMmfmTgqjQmInalzEDSrMRCNOOVOsrTuGWlbfMTThJHEBPmcV',
      },
      {
        privateKey:
          'gMWcRQZTAnrLMlFgAfGyukRICiLBKFqndsuEzMKuJuPlHlhbyVxPDxuWeZpI',
        revocationKey:
          'WtPCEiOBbBTKIcOsePFyUCwCbfFmuoJsZKHnuKnjMbvWSPJxOdDFtaNRvwCB',
      },
      {
        publicKey:
          'lSWpfeTYwKqrMmfmTgqjQmInalzEDSrMRCNOOVOsrTuGWlbfMTThJHEBPmcV',
        revocationKey:
          'WtPCEiOBbBTKIcOsePFyUCwCbfFmuoJsZKHnuKnjMbvWSPJxOdDFtaNRvwCB',
      },
      {},
    ];

    it.each(incompleteKeys)(
      'does not save the keys if one is missing',
      async (incompleteKeySet: Partial<Keys>) => {
        const userId = 234059;
        jest.spyOn(keyServerRepository, 'findUserKeysOrCreate');

        const keys = incompleteKeySet as Keys;

        await service.addKeysToUser(userId, keys);

        expect(keyServerRepository.findUserKeysOrCreate).toBeCalledTimes(0);
      },
    );
  });
});
