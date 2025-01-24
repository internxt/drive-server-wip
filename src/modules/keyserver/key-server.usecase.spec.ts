import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Keys, KeyServer } from './key-server.domain';
import { SequelizeKeyServerRepository } from './key-server.repository';
import { KeyServerUseCases } from './key-server.usecase';

describe('Key Server Use Cases', () => {
  let service: KeyServerUseCases;
  let keyServerRepository: DeepMocked<SequelizeKeyServerRepository>;

  beforeEach(async () => {
    keyServerRepository = createMock<SequelizeKeyServerRepository>();
    keyServerRepository.findUserKeysOrCreate.mockResolvedValue({} as any);

    service = new KeyServerUseCases(keyServerRepository);
  });

  it('when the service is instantiated, then it should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Add Keys To User', () => {
    it('When valid keys are provided, then it should save the keys to the user', async () => {
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

      expect(keyServerRepository.findUserKeysOrCreate).toHaveBeenCalledTimes(1);
      expect(keyServerRepository.findUserKeysOrCreate).toHaveBeenCalledWith(
        userId,
        {
          userId,
          ...keys,
          encryptVersion: 'ecc',
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
      'When keys are incomplete, then it should not save the keys',
      async (incompleteKeySet: Partial<Keys>) => {
        const userId = 234059;
        jest.spyOn(keyServerRepository, 'findUserKeysOrCreate');

        const keys = incompleteKeySet as Keys;

        await service.addKeysToUser(userId, keys);

        expect(keyServerRepository.findUserKeysOrCreate).toHaveBeenCalledTimes(
          0,
        );
      },
    );
  });

  describe('getPublicKey', () => {
    it('When a public key is found, then it should return the public key', async () => {
      const userId = 123;
      const mockPublicKey = 'mockPublicKey';

      jest
        .spyOn(keyServerRepository, 'findPublicKey')
        .mockResolvedValue(mockPublicKey);

      const result = await service.getPublicKey(userId);

      expect(result).toEqual(mockPublicKey);
      expect(keyServerRepository.findPublicKey).toHaveBeenCalledWith(userId);
    });

    it('When no public key is found, then it should return undefined', async () => {
      const userId = 123;
      jest
        .spyOn(keyServerRepository, 'findPublicKey')
        .mockResolvedValue(undefined);

      await service.getPublicKey(userId);
      expect(keyServerRepository.findPublicKey).toHaveBeenCalledWith(userId);
    });
  });

  describe('findUserKeys', () => {
    it('When user keys are found, then it should return the user keys', async () => {
      const userId = 123;

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
        .spyOn(keyServerRepository, 'findUserKeys')
        .mockResolvedValue(keyServer);

      const result = await service.findUserKeys(userId);

      expect(result).toEqual(keys);
      expect(keyServerRepository.findUserKeys).toHaveBeenCalledWith(userId);
    });
  });
});
