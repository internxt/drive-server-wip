import { createMock, type DeepMocked } from '@golevelup/ts-jest';
import {
  type Keys,
  KeyServer,
  UserKeysEncryptVersions,
} from './key-server.domain';
import { SequelizeKeyServerRepository } from './key-server.repository';
import {
  InvalidKeyServerException,
  KeyServerUseCases,
} from './key-server.usecase';
import { type Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';

describe('Key Server Use Cases', () => {
  let service: KeyServerUseCases;
  let keyServerRepository: DeepMocked<SequelizeKeyServerRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [KeyServerUseCases],
    })
      .setLogger(createMock<Logger>())
      .useMocker(() => createMock())
      .compile();
    service = moduleRef.get(KeyServerUseCases);
    keyServerRepository = moduleRef.get(SequelizeKeyServerRepository);
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

    it('When there are missing ecc keys, it should throw', async () => {
      const invalidEccKeys = {
        privateKey:
          'gMWcRQZTAnrLMlFgAfGyukRICiLBKFqndsuEzMKuJuPlHlhbyVxPDxuWeZpI',
        encryptVersion: UserKeysEncryptVersions.Ecc,
      };

      await expect(
        service.findOrCreateKeysForUser(userId, invalidEccKeys),
      ).rejects.toThrow(InvalidKeyServerException);
    });

    it('When there are missing kyber keys, it should throw', async () => {
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

    it('When the user public keys are retrieved, it should return them successfully', async () => {
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

    it('When the user public keys are retrieved but they are missing, then it returns null values', async () => {
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

  describe('parseKeysInput', () => {
    it('When both ecc and kyber keys are provided, then it should return the parsed keys', () => {
      const inputKeys = {
        ecc: {
          publicKey: 'eccPublicKey',
          privateKey: 'eccPrivateKey',
          revocationKey: 'eccRevocationKey',
        },
        kyber: {
          publicKey: 'kyberPublicKey',
          privateKey: 'kyberPrivateKey',
        },
      };

      const result = service.parseKeysInput(inputKeys);

      expect(result).toEqual({
        ecc: {
          publicKey: 'eccPublicKey',
          privateKey: 'eccPrivateKey',
          revocationKey: 'eccRevocationKey',
        },
        kyber: {
          publicKey: 'kyberPublicKey',
          privateKey: 'kyberPrivateKey',
        },
      });
    });

    it('When only ecc keys are provided, then it should return only ecc keys with null kyber keys', () => {
      const inputKeys = {
        ecc: {
          publicKey: 'eccPublicKey',
          privateKey: 'eccPrivateKey',
          revocationKey: 'eccRevocationKey',
        },
      };

      const result = service.parseKeysInput(inputKeys);

      expect(result).toEqual({
        ecc: {
          publicKey: 'eccPublicKey',
          privateKey: 'eccPrivateKey',
          revocationKey: 'eccRevocationKey',
        },
        kyber: null,
      });
    });

    it('When only kyber keys are provided, then it should return only kyber keys with null ecc keys', () => {
      const inputKeys = {
        kyber: {
          publicKey: 'kyberPublicKey',
          privateKey: 'kyberPrivateKey',
        },
      };

      const result = service.parseKeysInput(inputKeys);

      expect(result).toEqual({
        ecc: null,
        kyber: {
          publicKey: 'kyberPublicKey',
          privateKey: 'kyberPrivateKey',
        },
      });
    });

    it('When no keys are provided, then it should return both ecc and kyber as null', () => {
      const result = service.parseKeysInput({});

      expect(result).toEqual({
        ecc: null,
        kyber: null,
      });
    });

    it('When old keys are provided and new keys are missing, it should fall back to old keys', () => {
      const oldKeys = {
        publicKey: 'oldPublicKey',
        privateKey: 'oldPrivateKey',
        revocationKey: 'oldRevocationKey',
      };

      const result = service.parseKeysInput({}, oldKeys);

      expect(result).toEqual({
        ecc: {
          publicKey: 'oldPublicKey',
          privateKey: 'oldPrivateKey',
          revocationKey: 'oldRevocationKey',
        },
        kyber: null,
      });
    });
  });
});
