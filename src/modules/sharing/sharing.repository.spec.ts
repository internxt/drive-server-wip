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

  describe('findFilesByOwnerAndSharedWithMe', () => {
    const userId = v4();
    const offset = 0;
    const limit = 10;

    it('When called, then it should return only the latest sharing for each file', async () => {
      const file1 = newFile();
      file1.uuid = v4();
      const user = newUser();
      const uniqueItems = [{ itemId: file1.uuid }];
      const itemIds = [file1.uuid];

      const userModel = { ...user, get: jest.fn().mockReturnValue(user) };
      const fileModel = {
        ...file1,
        user: userModel,
        get: jest.fn().mockReturnValue(file1),
      };

      const oldSharingData = newSharing();
      oldSharingData.itemId = file1.uuid;
      oldSharingData.createdAt = new Date('2023-01-01');
      const oldSharingModel = {
        ...oldSharingData,
        file: fileModel,
        get: jest.fn().mockReturnValue(oldSharingData),
      };

      const latestSharingData = newSharing();
      latestSharingData.itemId = file1.uuid;
      latestSharingData.createdAt = new Date('2023-01-02');
      const latestSharingModel = {
        ...latestSharingData,
        file: fileModel,
        get: jest.fn().mockReturnValue(latestSharingData),
      };

      const allSharingsForItems = [oldSharingModel, latestSharingModel];

      const findAllSpy = jest.spyOn(sharingModel, 'findAll');
      findAllSpy.mockResolvedValueOnce(uniqueItems as any);
      findAllSpy.mockResolvedValueOnce(allSharingsForItems as any);

      const result = await repository.findFilesByOwnerAndSharedWithMe(
        userId,
        offset,
        limit,
      );

      expect(findAllSpy).toHaveBeenCalledTimes(2);
      expect(findAllSpy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          attributes: ['itemId'],
          group: ['itemId'],
          raw: true,
        }),
      );
      expect(findAllSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: {
            itemId: { [Op.in]: itemIds },
            [Op.or]: [{ ownerId: userId }, { sharedWith: userId }],
          },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].createdAt.toISOString()).toBe(
        latestSharingData.createdAt.toISOString(),
      );
    });

    it('When no unique items are found, then it should return an empty array', async () => {
      const findAllSpy = jest
        .spyOn(sharingModel, 'findAll')
        .mockResolvedValueOnce([]);

      const result = await repository.findFilesByOwnerAndSharedWithMe(
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

    it('When called, then it should perform two queries and return the latest shared files', async () => {
      const file1 = newFile();
      file1.uuid = v4();
      const creator = newUser();
      const uniqueItems = [{ itemId: file1.uuid }];
      const itemIds = [file1.uuid];

      const fileWithWorkspaceUser = { ...file1, workspaceUser: { creator } };

      const oldSharingData = newSharing();
      oldSharingData.itemId = file1.uuid;
      oldSharingData.createdAt = new Date('2023-01-01');
      const oldSharingModel = {
        ...oldSharingData,
        file: fileWithWorkspaceUser,
        get: jest.fn().mockReturnValue({
          ...oldSharingData,
          file: fileWithWorkspaceUser,
        }),
      };

      const latestSharingData = newSharing();
      latestSharingData.itemId = file1.uuid;
      latestSharingData.createdAt = new Date('2023-01-02');
      const latestSharingModel = {
        ...latestSharingData,
        file: fileWithWorkspaceUser,
        get: jest.fn().mockReturnValue({
          ...latestSharingData,
          file: fileWithWorkspaceUser,
        }),
      };

      const allSharingsForItems = [oldSharingModel, latestSharingModel];

      const findAllSpy = jest.spyOn(sharingModel, 'findAll');
      findAllSpy.mockResolvedValueOnce(uniqueItems as any);
      findAllSpy.mockResolvedValueOnce(allSharingsForItems as any);

      const result = await repository.findFilesSharedInWorkspaceByOwnerAndTeams(
        ownerId,
        workspaceId,
        teamIds,
        { offset, limit },
      );

      expect(findAllSpy).toHaveBeenCalledTimes(2);
      expect(findAllSpy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          attributes: ['itemId'],
          group: ['itemId'],
          raw: true,
        }),
      );
      expect(findAllSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { itemId: { [Op.in]: itemIds } },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].createdAt.toISOString()).toBe(
        latestSharingData.createdAt.toISOString(),
      );
    });

    it('When no unique items are found, then it should return an empty array', async () => {
      const findAllSpy = jest
        .spyOn(sharingModel, 'findAll')
        .mockResolvedValueOnce([]);

      const result = await repository.findFilesSharedInWorkspaceByOwnerAndTeams(
        ownerId,
        workspaceId,
        teamIds,
        { offset, limit },
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
        attributes: [
          [Sequelize.literal('MAX("SharingModel"."created_at")'), 'createdAt'],
        ],
        group: [
          'SharingModel.item_id',
          'folder.id',
          'folder->workspaceUser.id',
          'folder->workspaceUser->creator.id',
        ],
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

      await repository.findFoldersSharedInWorkspaceByOwnerAndTeams(
        ownerId,
        workspaceId,
        teamIds,
        { offset, limit, order: orderBy },
      );

      expect(sharingModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining(expectedQuery),
      );
    });

    it('When returned successfully, then it returns a folder and its creator', async () => {
      const orderBy: [string, string][] = [['plainName', 'ASC']];
      const sharedFolder = newSharing();
      const folder = newFolder();
      const creator = newUser();

      const sharedFolderWithUser = {
        ...sharedFolder,
        get: jest.fn().mockReturnValue({
          ...sharedFolder,
          folder: {
            ...folder,
            workspaceUser: {
              creator,
            },
          },
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
