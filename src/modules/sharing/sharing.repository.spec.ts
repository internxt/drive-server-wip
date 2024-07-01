import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { createMock } from '@golevelup/ts-jest';
import { SharingModel } from './models';
import { Sharing } from './sharing.domain';
import { SequelizeSharingRepository } from './sharing.repository';
import { newFile, newSharing, newUser } from '../../../test/fixtures';
import { User } from '../user/user.domain';
import { v4 } from 'uuid';

describe('SharingRepository', () => {
  let repository: SequelizeSharingRepository;
  let sharingModel: typeof SharingModel;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequelizeSharingRepository],
    })
      .useMocker(() => createMock())
      .compile();

    repository = module.get<SequelizeSharingRepository>(
      SequelizeSharingRepository,
    );
    sharingModel = module.get<typeof SharingModel>(getModelToken(SharingModel));
  });

  describe('findFilesByOwnerAndSharedWithTeamInworkspace', () => {
    it('When files are searched by owner and team in workspace, then it should return the shared files', async () => {
      const teamId = v4();
      const ownerId = v4();
      const offset = 0;
      const limit = 10;
      const orderBy = [['name', 'ASC']] as any;
      const sharing = newSharing();
      const file = newFile();
      const creator = newUser();

      const mockSharing = {
        get: jest.fn().mockReturnValue({
          ...sharing,
          file: {
            ...file,
            workspaceUser: {
              creator,
            },
          },
        }),
      };

      jest
        .spyOn(sharingModel, 'findAll')
        .mockResolvedValue([mockSharing] as any);

      const result =
        await repository.findFilesByOwnerAndSharedWithTeamInworkspace(
          teamId,
          ownerId,
          offset,
          limit,
          orderBy,
        );

      expect(result[0]).toBeInstanceOf(Sharing);
      expect(result[0].file.user).toBeInstanceOf(User);
      expect(result[0].file).toMatchObject({ ...file, user: creator });
    });
  });

  describe('findFoldersByOwnerAndSharedWithTeamInworkspace', () => {
    it('When folders are searched by owner and team in workspace, then it should return the shared folders', async () => {
      const teamId = v4();
      const ownerId = v4();
      const offset = 0;
      const limit = 10;
      const orderBy = [['name', 'ASC']] as any;

      const mockSharing = {
        get: jest.fn().mockReturnValue({
          ...newSharing(),
          folder: {
            workspaceUser: {
              creator: newUser(),
            },
          },
        }),
      };

      jest
        .spyOn(sharingModel, 'findAll')
        .mockResolvedValue([mockSharing] as any);

      const result =
        await repository.findFoldersByOwnerAndSharedWithTeamInworkspace(
          teamId,
          ownerId,
          offset,
          limit,
          orderBy,
        );

      expect(result[0]).toBeInstanceOf(Sharing);
      expect(result[0].folder.user).toBeInstanceOf(User);
    });
  });
});
