import { Test, TestingModule } from '@nestjs/testing';
import { SequelizeUserRepository } from '../user/user.repository';
import { createMock } from '@golevelup/ts-jest';
import { WorkspacesUsecases } from '../workspaces/workspaces.usecase';
import {
  newUser,
  newWorkspace,
  newWorkspaceTeam,
} from '../../../test/fixtures';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { v4 } from 'uuid';
import { GatewayUseCases } from './gateway.usecase';
import { InitializeWorkspaceDto } from './dto/initialize-workspace.dto';
import { UserUseCases } from '../user/user.usecase';

describe('GatewayUseCases', () => {
  let service: GatewayUseCases;
  let userRepository: SequelizeUserRepository;
  let userUseCases: UserUseCases;

  let workspaceUseCases: WorkspacesUsecases;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GatewayUseCases],
    })
      .useMocker(createMock)
      .compile();

    service = module.get<GatewayUseCases>(GatewayUseCases);
    userRepository = module.get<SequelizeUserRepository>(
      SequelizeUserRepository,
    );
    userUseCases = module.get<UserUseCases>(UserUseCases);
    workspaceUseCases = module.get<WorkspacesUsecases>(WorkspacesUsecases);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeWorkspace', () => {
    const owner = newUser();
    const maxSpaceBytes = 1000000;
    const workspaceAddress = '123 Main St';
    const workspacePhoneNumber = '+1 (123) 456-7890';

    it('When owner does not exist, then it should throw', async () => {
      jest
        .spyOn(workspaceUseCases, 'initiateWorkspace')
        .mockRejectedValueOnce(new BadRequestException());

      const initializeWorkspaceDto: InitializeWorkspaceDto = {
        ownerId: owner.uuid,
        maxSpaceBytes,
        address: workspaceAddress,
        phoneNumber: workspacePhoneNumber,
        numberOfSeats: 20,
      };

      await expect(
        service.initializeWorkspace(initializeWorkspaceDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('When workspace, default team and root folder are successfully created, then it should return the new workspace', async () => {
      const newDefaultTeam = newWorkspaceTeam();
      const createdWorkspace = newWorkspace({
        owner,
        attributes: {
          defaultTeamId: newDefaultTeam.id,
          address: workspaceAddress,
          phoneNumber: workspacePhoneNumber,
        },
      });
      jest
        .spyOn(workspaceUseCases, 'initiateWorkspace')
        .mockResolvedValueOnce({ workspace: createdWorkspace });
      const initializeWorkspaceDto: InitializeWorkspaceDto = {
        ownerId: owner.uuid,
        maxSpaceBytes,
        address: workspaceAddress,
        phoneNumber: workspacePhoneNumber,
        numberOfSeats: 20,
      };
      await expect(
        service.initializeWorkspace(initializeWorkspaceDto),
      ).resolves.toStrictEqual({ workspace: createdWorkspace });
    });

    describe('updateWorkspaceStorage', () => {
      it('When user is not found, then it should throw', async () => {
        jest.spyOn(userRepository, 'findByUuid').mockResolvedValueOnce(null);
        await expect(
          service.updateWorkspaceStorage(v4(), maxSpaceBytes, 4),
        ).rejects.toThrow(BadRequestException);
      });

      it('When the workspace is not found, then it should throw', async () => {
        jest.spyOn(userRepository, 'findByUuid').mockResolvedValueOnce(owner);
        jest.spyOn(workspaceUseCases, 'findOne').mockResolvedValueOnce(null);

        await expect(
          service.updateWorkspaceStorage(owner.uuid, maxSpaceBytes, 4),
        ).rejects.toThrow(NotFoundException);
      });

      it('When owner and workspaces are found, then it should update the workspaces completed', async () => {
        const workspaceUserEmail = 'user@workspace.com';
        const workspaceUser = newUser({
          attributes: {
            email: workspaceUserEmail,
            username: workspaceUserEmail,
            bridgeUser: workspaceUserEmail,
          },
        });
        const numberOfSeats = 4;
        const workspace = newWorkspace({
          owner,
          attributes: {
            ownerId: owner.uuid,
            workspaceUserId: workspaceUser.uuid,
            numberOfSeats,
          },
        });

        jest
          .spyOn(userRepository, 'findByUuid')
          .mockResolvedValueOnce(owner)
          .mockResolvedValueOnce(workspaceUser);

        jest
          .spyOn(workspaceUseCases, 'findOne')
          .mockResolvedValueOnce(workspace);

        await service.updateWorkspaceStorage(
          owner.uuid,
          maxSpaceBytes,
          numberOfSeats,
        );

        expect(workspaceUseCases.updateWorkspaceLimit).toHaveBeenCalledWith(
          workspace.id,
          maxSpaceBytes,
          undefined,
        );
      });

      it('When owner and workspaces are found and a diferent number of seats is received, then it should update the workspaces completed', async () => {
        const workspaceUserEmail = 'user@workspace.com';
        const workspaceUser = newUser({
          attributes: {
            email: workspaceUserEmail,
            username: workspaceUserEmail,
            bridgeUser: workspaceUserEmail,
          },
        });
        const numberOfSeats = 4;
        const workspace = newWorkspace({
          owner,
          attributes: {
            ownerId: owner.uuid,
            workspaceUserId: workspaceUser.uuid,
            numberOfSeats: 3,
          },
        });

        jest
          .spyOn(userRepository, 'findByUuid')
          .mockResolvedValueOnce(owner)
          .mockResolvedValueOnce(workspaceUser);

        jest
          .spyOn(workspaceUseCases, 'findOne')
          .mockResolvedValueOnce(workspace);

        jest
          .spyOn(workspaceUseCases, 'updateWorkspaceMemberCount')
          .mockResolvedValueOnce();

        await service.updateWorkspaceStorage(
          owner.uuid,
          maxSpaceBytes,
          numberOfSeats,
        );

        expect(
          workspaceUseCases.updateWorkspaceMemberCount,
        ).toHaveBeenCalledWith(workspace.id, numberOfSeats);

        expect(workspaceUseCases.updateWorkspaceLimit).toHaveBeenCalledWith(
          workspace.id,
          maxSpaceBytes,
          numberOfSeats,
        );
      });
    });

    describe('validateStorageForPlanChange', () => {
      it('When user is not found, then it should throw', async () => {
        jest.spyOn(userRepository, 'findByUuid').mockResolvedValueOnce(null);
        await expect(
          service.validateStorageForPlanChange(v4(), maxSpaceBytes, 4),
        ).rejects.toThrow(BadRequestException);
      });

      it('When the workspace is not found, then it should throw', async () => {
        jest.spyOn(userRepository, 'findByUuid').mockResolvedValueOnce(owner);
        jest.spyOn(workspaceUseCases, 'findOne').mockResolvedValueOnce(null);

        await expect(
          service.validateStorageForPlanChange(owner.uuid, maxSpaceBytes, 4),
        ).rejects.toThrow(NotFoundException);
      });

      it('When owner and workspaces are found, then it should call validateStorageForPlanChange', async () => {
        const owner = newUser();
        const workspace = newWorkspace({ owner });
        jest.spyOn(userRepository, 'findByUuid').mockResolvedValueOnce(owner);
        jest
          .spyOn(workspaceUseCases, 'findOne')
          .mockResolvedValueOnce(workspace);

        await service.validateStorageForPlanChange(
          owner.uuid,
          maxSpaceBytes,
          4,
        );

        expect(
          workspaceUseCases.validateStorageForPlanChange,
        ).toHaveBeenCalledWith(workspace, maxSpaceBytes, 4);
      });
    });

    describe('destroyWorkspace', () => {
      it('When owner is not found, then it should throw', async () => {
        jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(null);

        await expect(service.destroyWorkspace(owner.uuid)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('When the workspace is not found, then it should throw', async () => {
        jest.spyOn(workspaceUseCases, 'findOne').mockResolvedValue(null);

        await expect(service.destroyWorkspace(owner.uuid)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('When owner and workspaces are found, then it should delete all workspaces completed', async () => {
        const workspace = newWorkspace({
          owner,
          attributes: { ownerId: owner.uuid },
        });

        jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(owner);
        jest.spyOn(workspaceUseCases, 'findOne').mockResolvedValue(workspace);

        await service.destroyWorkspace(owner.uuid);

        expect(workspaceUseCases.deleteWorkspaceContent).toHaveBeenCalledWith(
          workspace.id,
          owner,
        );
      });
    });
  });

  describe('users', () => {
    describe('getUserByEmail', () => {
      const user = newUser();

      it('When user is not found, then it should throw', async () => {
        jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(null);

        await expect(service.getUserByEmail(user.email)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('When user exists, then it is returned ', async () => {
        jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(user);

        await expect(service.getUserByEmail(user.email)).resolves.toStrictEqual(
          user,
        );
      });
    });

    describe('checkUserStorageExpansion', () => {
      const user = newUser();

      it('When user is not found, then it should throw', async () => {
        jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(null);

        await expect(
          service.checkUserStorageExpansion(user.uuid),
        ).rejects.toThrow(NotFoundException);
      });

      it('When user exists, then it should return storage stackability data', async () => {
        const response = {
          canExpand: true,
          currentMaxSpaceBytes: 10000,
          expandableBytes: 13400,
        };

        jest.spyOn(userRepository, 'findByUuid').mockResolvedValue(user);
        jest
          .spyOn(userUseCases, 'canUserExpandStorage')
          .mockResolvedValue(response);

        await expect(
          service.checkUserStorageExpansion(user.uuid, 100),
        ).resolves.toStrictEqual(response);
      });
    });
  });
});
