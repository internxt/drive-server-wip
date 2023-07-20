import { Test, TestingModule } from '@nestjs/testing';
import { SequelizePrivateSharingRepository } from './private-sharing.repository';
import { PrivateSharingUseCase } from './private-sharing.usecase';
import { Folder } from '../folder/folder.domain';
import { v4 } from 'uuid';
import { User } from '../user/user.domain';

describe('PrivateSharingUseCase', () => {
  let privateSharingUseCase: PrivateSharingUseCase;
  let privateSharingRespository: SequelizePrivateSharingRepository;

  const mockRepository = {
    findByOwner: jest.fn(),
    findBySharedWith: jest.fn(),
  };

  const user = User.build({
    userId: 'JohnDoe userId',
    name: 'John',
    lastname: 'Doe',
    uuid: v4(),
    email: 'johnTwo@doe.com',
    username: 'johnTwo@doe.com',
    bridgeUser: 'johnTwo@doe.com',
    password: '',
    mnemonic: 'john doe mnemonic',
    referrer: v4(),
    referralCode: v4(),
    credit: 0,
    hKey: new Buffer('john doe hKey'),
    rootFolderId: 1,
    errorLoginCount: 0,
    isEmailActivitySended: 1,
    lastResend: new Date(),
    syncDate: new Date(),
    welcomePack: true,
    registerCompleted: true,
    id: 0,
    secret_2FA: '',
    backupsBucket: '',
    sharedWorkspace: false,
    tempKey: '',
    avatar: '',
  });

  const folders: Folder[] = [
    Folder.build({
      id: 0,
      parentId: null,
      name: 'FolderTwo',
      bucket: 'bucketTwo',
      userId: user.id,
      uuid: v4(),
      plainName: 'FolderTwo',
      encryptVersion: '03-aes',
      deleted: false,
      removed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      removedAt: null,
      deletedAt: null,
    }),
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrivateSharingUseCase,
        {
          provide: SequelizePrivateSharingRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    privateSharingUseCase = module.get<PrivateSharingUseCase>(
      PrivateSharingUseCase,
    );
    privateSharingRespository = module.get<SequelizePrivateSharingRepository>(
      SequelizePrivateSharingRepository,
    );
  });

  it('should be defined', () => {
    expect(privateSharingUseCase).toBeDefined();
    expect(privateSharingRespository).toBeDefined();
  });

  describe('getSharedFoldersByOwner', () => {
    it('should return the folders shared by a specific user', async () => {
      jest
        .spyOn(privateSharingRespository, 'findByOwner')
        .mockResolvedValue(folders);

      const offset = 0;
      const limit = 10;
      const order: [string, string][] = [['createdAt', 'DESC']];

      const result = await privateSharingUseCase.getSharedFoldersByOwner(
        user,
        offset,
        limit,
        order,
      );

      expect(result).toEqual(folders);
      expect(privateSharingRespository.findByOwner).toHaveBeenCalledWith(
        user.uuid,
        offset,
        limit,
        order,
      );
    });

    it('should return the folders shared with a specific user', async () => {
      jest
        .spyOn(privateSharingRespository, 'findBySharedWith')
        .mockResolvedValue(folders);

      const offset = 0;
      const limit = 10;
      const order: [string, string][] = [['createdAt', 'DESC']];

      const result = await privateSharingUseCase.getSharedFoldersBySharedWith(
        user,
        offset,
        limit,
        order,
      );

      expect(result).toEqual(folders);
      expect(privateSharingRespository.findBySharedWith).toHaveBeenCalledWith(
        user.uuid,
        offset,
        limit,
        order,
      );
    });
  });
});
