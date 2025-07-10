import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { createMock } from '@golevelup/ts-jest';
import { RoleModel, SharingModel } from './models';
import { SharedWithType, Sharing } from './sharing.domain';
import { SequelizeSharingRepository } from './sharing.repository';
import {
  newFile,
  newFolder,
  newSharing,
  newUser,
} from '../../../test/fixtures';
import { v4 } from 'uuid';
import { SharingRolesModel } from './models/sharing-roles.model';
import { Op, Sequelize } from 'sequelize';
import { WorkspaceItemUserModel } from '../workspaces/models/workspace-items-users.model';
import { FileStatus } from '../file/file.domain';
import { FileModel } from '../file/file.model';
import { UserModel } from '../user/user.model';
import { FolderModel } from '../folder/folder.model';

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

  describe('findSharingsBySharedWithAndAttributes', () => {
    it('When filters are included, then it should call the query with the correct filters', async () => {
      const sharedWithValues = [v4(), v4()];
      const filters = { sharedWithType: SharedWithType.Individual };
      const offset = 0;
      const limit = 10;

      const expectedQuery = {
        where: {
          ...filters,
          sharedWith: {
            [Op.in]: sharedWithValues,
          },
        },
        include: [
          {
            model: SharingRolesModel,
            include: [RoleModel],
          },
        ],
        limit,
        offset,
        order: [],
        replacements: {
          priorityRole: undefined,
        },
      };

      await repository.findSharingsBySharedWithAndAttributes(
        sharedWithValues,
        filters,
        { offset, limit },
      );

      expect(sharingModel.findAll).toHaveBeenCalledWith(expectedQuery);
    });

    it('When givePriorityToRole is provided, then it should call the query prioritizing the role', async () => {
      const sharedWithValues = [v4(), v4()];
      const filters = {};
      const offset = 0;
      const limit = 10;
      const givePriorityToRole = 'admin';

      const expectedQuery = {
        where: {
          ...filters,
          sharedWith: {
            [Op.in]: sharedWithValues,
          },
        },
        include: [
          {
            model: SharingRolesModel,
            include: [RoleModel],
          },
        ],
        limit,
        offset,
      };

      await repository.findSharingsBySharedWithAndAttributes(
        sharedWithValues,
        filters,
        { offset, limit, givePriorityToRole },
      );

      expect(sharingModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          ...expectedQuery,
          order: [
            [
              {
                val: expect.stringContaining(
                  `CASE WHEN "role->role"."name" = :priorityRole THEN 1 ELSE 2 END`,
                ),
              },
              'ASC',
            ],
          ],
          replacements: {
            priorityRole: givePriorityToRole,
          },
        }),
      );
    });

    it('When no results are found, then it should return an empty array', async () => {
      const sharedWithValues = [v4(), v4()];
      const filters = {};
      const offset = 0;
      const limit = 10;

      jest.spyOn(sharingModel, 'findAll').mockResolvedValue([]);

      const result = await repository.findSharingsBySharedWithAndAttributes(
        sharedWithValues,
        filters,
        { offset, limit },
      );

      expect(result).toEqual([]);
    });
  });

  describe('findByOwnerAndSharedWithMe', () => {
    const userId = v4();
    const offset = 0;
    const limit = 10;

    it('When called, then it should return folders with single query', async () => {
      const user = newUser();
      const folder = newFolder({ owner: user });
      const sharing1 = newSharing({ item: folder, owner: user });
      const sharing2 = newSharing({ item: folder, owner: user });

      const mockSharingModels = [sharing1, sharing2].map((sharing) => {
        return {
          ...sharing,
          get: jest.fn().mockReturnValue(sharing),
          folder: {
            ...folder,
            get: jest.fn().mockReturnValue(folder),
            user: {
              ...user,
              get: jest.fn().mockReturnValue(user),
            },
          },
        };
      });

      const findAllSpy = jest
        .spyOn(sharingModel, 'findAll')
        .mockResolvedValueOnce(mockSharingModels as any);

      const result = await repository.findByOwnerAndSharedWithMe(
        userId,
        offset,
        limit,
      );

      expect(findAllSpy).toHaveBeenCalledTimes(1);
      expect(findAllSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            [Op.or]: [{ ownerId: userId }, { sharedWith: userId }],
          },
          include: expect.arrayContaining([
            expect.objectContaining({
              model: FolderModel,
            }),
          ]),
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('When no folders are found, then it should return an empty array', async () => {
      const findAllSpy = jest
        .spyOn(sharingModel, 'findAll')
        .mockResolvedValueOnce([]);

      const result = await repository.findByOwnerAndSharedWithMe(
        userId,
        offset,
        limit,
      );

      expect(result).toEqual([]);
      expect(findAllSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('findFilesSharedInWorkspaceByOwnerAndTeams', () => {
    const ownerId = v4();
    const workspaceId = v4();
    const teamIds = [v4(), v4()];
    const offset = 0;
    const limit = 10;

    it('When called, then it should return workspace files with single query', async () => {
      const creator = newUser();
      const file = newFile({ owner: creator });
      const sharing1 = newSharing({ item: file, owner: creator });
      const sharing2 = newSharing({ item: file, owner: creator });

      const mockSharingModels = [sharing1, sharing2].map((sharing) => {
        const fileWithWorkspaceUser = { ...file, workspaceUser: { creator } };
        return {
          ...sharing,
          file: fileWithWorkspaceUser,
          get: jest
            .fn()
            .mockReturnValue({ ...sharing, file: fileWithWorkspaceUser }),
        };
      });

      const findAllSpy = jest
        .spyOn(sharingModel, 'findAll')
        .mockResolvedValueOnce(mockSharingModels as any);

      const result = await repository.findAllSharingsForWorkspaceFileItems(
        workspaceId,
        undefined,
        { ownerId, teamIds, offset, limit },
      );

      expect(findAllSpy).toHaveBeenCalledTimes(1);
      expect(findAllSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            [Op.or]: [
              {
                sharedWith: { [Op.in]: teamIds },
                sharedWithType: SharedWithType.WorkspaceTeam,
              },
              { '$file->workspaceUser.created_by$': ownerId },
            ],
          }),
          include: expect.arrayContaining([
            expect.objectContaining({
              model: FileModel,
            }),
          ]),
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('When no files are found, then it should return an empty array', async () => {
      const findAllSpy = jest
        .spyOn(sharingModel, 'findAll')
        .mockResolvedValueOnce([]);

      const result = await repository.findAllSharingsForWorkspaceFileItems(
        workspaceId,
        undefined,
        { ownerId, teamIds, offset, limit },
      );

      expect(result).toEqual([]);
      expect(findAllSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('findFoldersSharedInWorkspaceByOwnerAndTeams', () => {
    const ownerId = v4();
    const workspaceId = v4();
    const teamIds = [v4(), v4()];
    const offset = 0;
    const limit = 10;

    it('When called, then it should call the query with the correct owner, teams and order', async () => {
      const orderBy: [string, string][] = [['plainName', 'ASC']];

      const expectedQuery = {
        where: {
          [Op.or]: [
            {
              sharedWith: { [Op.in]: teamIds },
              sharedWithType: SharedWithType.WorkspaceTeam,
            },
            {
              '$folder->workspaceUser.created_by$': ownerId,
            },
          ],
        },
        include: [
          {
            model: FolderModel,
            where: {
              deleted: false,
              removed: false,
            },
            include: [
              {
                model: WorkspaceItemUserModel,
                required: true,
                where: {
                  workspaceId,
                },
                include: [
                  {
                    model: UserModel,
                    as: 'creator',
                    attributes: ['uuid', 'email', 'name', 'lastname', 'avatar'],
                  },
                ],
              },
            ],
          },
        ],
        order: orderBy,
        limit,
        offset,
      };

      const findAllSpy = jest
        .spyOn(sharingModel, 'findAll')
        .mockResolvedValueOnce([]);

      await repository.findFoldersSharedInWorkspaceByOwnerAndTeams(
        ownerId,
        workspaceId,
        teamIds,
        { offset, limit, order: orderBy },
      );

      expect(findAllSpy).toHaveBeenCalledWith(
        expect.objectContaining(expectedQuery),
      );
    });

    it('When returned successfully, then it returns a folder and its creator', async () => {
      const orderBy: [string, string][] = [['plainName', 'ASC']];
      const creator = newUser();
      const folder = newFolder({ owner: creator });
      const sharedFolder = newSharing({ item: folder, owner: creator });

      const folderWithWorkspaceUser = { ...folder, workspaceUser: { creator } };
      const sharedFolderWithUser = {
        ...sharedFolder,
        folder: folderWithWorkspaceUser,
        get: jest.fn().mockReturnValue({
          ...sharedFolder,
          folder: folderWithWorkspaceUser,
        }),
      };

      jest
        .spyOn(sharingModel, 'findAll')
        .mockResolvedValue([sharedFolderWithUser] as any);

      const result =
        await repository.findFoldersSharedInWorkspaceByOwnerAndTeams(
          ownerId,
          workspaceId,
          teamIds,
          { offset, limit, order: orderBy },
        );

      expect(result[0]).toBeInstanceOf(Sharing);
      expect(result[0].folder).toMatchObject({
        ...folder,
        user: {
          uuid: creator.uuid,
          email: creator.email,
          name: creator.name,
          lastname: creator.lastname,
          avatar: creator.avatar,
        },
      });
    });
  });
});
