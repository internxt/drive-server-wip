import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Keys, KeyServer, UserKeysEncryptVersions } from './key-server.domain';
import { SequelizeKeyServerRepository } from './key-server.repository';
import {
  InvalidKeyServerException,
  KeyServerUseCases,
} from './key-server.usecase';

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
        encryptVersion: UserKeysEncryptVersions.Ecc,
      });

      jest
        .spyOn(keyServerRepository, 'findUserKeysOrCreate')
        .mockResolvedValue([keyServer, true]);

      await service.addKeysToUser(userId, { ecc: keys });

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

        await service.addKeysToUser(userId, { ecc: keys });

        expect(keyServerRepository.findUserKeysOrCreate).toHaveBeenCalledTimes(
          0,
        );
      },
    );
  });

  describe('findOrCreateKeysForUser', () => {
    const userId = 234059;

    it('When invalid ecc keys are provided, it should throw', async () => {
      const invalidEccKeys = {
        privateKey:
          'gMWcRQZTAnrLMlFgAfGyukRICiLBKFqndsuEzMKuJuPlHlhbyVxPDxuWeZpI',
        encryptVersion: UserKeysEncryptVersions.Ecc,
      };

      await expect(
        service.findOrCreateKeysForUser(userId, invalidEccKeys),
      ).rejects.toThrow(InvalidKeyServerException);
    });

    it('When invalid kyber keys are provided, it should throw', async () => {
      const invalidKyberKeys = {
        privateKey:
          'gMWcRQZTAnrLMlFgAfGyukRICiLBKFqndsuEzMKuJuPlHlhbyVxPDxuWeZpI',
        encryptVersion: UserKeysEncryptVersions.Kyber,
      };

      await expect(
        service.findOrCreateKeysForUser(userId, invalidKyberKeys),
      ).rejects.toThrow(InvalidKeyServerException);
    });

    it('When valid keys are provided, then it should create them', async () => {
      const validEccKey = {
        privateKey:
          'gMWcRQZTAnrLMlFgAfGyukRICiLBKFqndsuEzMKuJuPlHlhbyVxPDxuWeZpI',
        publicKey:
          'lSWpfeTYwKqrMmfmTgqjQmInalzEDSrMRCNOOVOsrTuGWlbfMTThJHEBPmcV',
        revocationKey:
          'WtPCEiOBbBTKIcOsePFyUCwCbfFmuoJsZKHnuKnjMbvWSPJxOdDFtaNRvwCB',
        encryptVersion: UserKeysEncryptVersions.Ecc,
      };

      const keyServer = new KeyServer({
        id: 430,
        userId,
        ...validEccKey,
      });

      jest
        .spyOn(keyServerRepository, 'findUserKeysOrCreate')
        .mockResolvedValue([keyServer, true]);

      await service.findOrCreateKeysForUser(userId, validEccKey);

      expect(keyServerRepository.findUserKeysOrCreate).toHaveBeenCalledTimes(1);
      expect(keyServerRepository.findUserKeysOrCreate).toHaveBeenCalledWith(
        userId,
        {
          userId,
          ...validEccKey,
        },
      );
    });
  });

  describe('updateByUserAndEncryptVersion', () => {
    const userId = 234059;

    it('When keys need to be update, then it should update them accordingly', async () => {
      const validEccKey = {
        privateKey:
          'gMWcRQZTAnrLMlFgAfGyukRICiLBKFqndsuEzMKuJuPlHlhbyVxPDxuWeZpI',
        publicKey:
          'lSWpfeTYwKqrMmfmTgqjQmInalzEDSrMRCNOOVOsrTuGWlbfMTThJHEBPmcV',
        revocationKey:
          'WtPCEiOBbBTKIcOsePFyUCwCbfFmuoJsZKHnuKnjMbvWSPJxOdDFtaNRvwCB',
      };

      await expect(
        service.updateByUserAndEncryptVersion(
          userId,
          UserKeysEncryptVersions.Ecc,
          validEccKey,
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('getPublicKeys', () => {
    const userId = 234059;
    const KeysData = {
      privateKey:
        'gMWcRQZTAnrLMlFgAfGyukRICiLBKFqndsuEzMKuJuPlHlhbyVxPDxuWeZpI',
      publicKey: 'lSWpfeTYwKqrMmfmTgqjQmInalzEDSrMRCNOOVOsrTuGWlbfMTThJHEBPmcV',
      revocationKey:
        'WtPCEiOBbBTKIcOsePFyUCwCbfFmuoJsZKHnuKnjMbvWSPJxOdDFtaNRvwCB',
    };

    it('When user public keys are retrieved, it should return them successfully', async () => {
      const eccKey = new KeyServer({
        id: 430,
        userId,
        ...KeysData,
        encryptVersion: UserKeysEncryptVersions.Ecc,
      });

      const kyberKey = new KeyServer({
        id: 431,
        userId,
        ...KeysData,
        encryptVersion: UserKeysEncryptVersions.Kyber,
      });

      jest
        .spyOn(keyServerRepository, 'findUserKeys')
        .mockResolvedValue([eccKey, kyberKey]);

      const userKeys = await service.getPublicKeys(userId);

      expect(userKeys).toEqual({
        kyber: kyberKey.publicKey,
        ecc: eccKey.publicKey,
      });
    });

    it('When user public keys are retrieved there are keys missing, it should them as empty', async () => {
      const eccKey = new KeyServer({
        id: 430,
        userId,
        ...KeysData,
        encryptVersion: UserKeysEncryptVersions.Ecc,
      });

      jest
        .spyOn(keyServerRepository, 'findUserKeys')
        .mockResolvedValueOnce([eccKey]);

      jest.spyOn(keyServerRepository, 'findUserKeys').mockResolvedValueOnce([]);

      const userKeys = await service.getPublicKeys(userId);
      const noKeys = await service.getPublicKeys(userId);

      expect(userKeys).toEqual({
        kyber: null,
        ecc: eccKey.publicKey,
      });

      expect(noKeys).toEqual({
        kyber: null,
        ecc: null,
      });
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

      const ecc = new KeyServer({
        id: 430,
        userId,
        ...keys,
        encryptVersion: UserKeysEncryptVersions.Ecc,
      });

      const kyber = new KeyServer({
        id: 431,
        userId,
        ...keys,
        encryptVersion: UserKeysEncryptVersions.Kyber,
      });

      jest
        .spyOn(keyServerRepository, 'findUserKeys')
        .mockResolvedValue([ecc, kyber]);

      const result = await service.findUserKeys(userId);

      expect(result).toEqual({ kyber, ecc });
      expect(keyServerRepository.findUserKeys).toHaveBeenCalledWith(userId);
    });
  });
});
