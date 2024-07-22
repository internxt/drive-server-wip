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
import { BridgeService } from '../../externals/bridge/bridge.service';
import { v4 } from 'uuid';
import { GatewayUseCases } from './gateway.usecase';
import { InitializeWorkspaceDto } from './dto/initialize-workspace.dto';

describe('GatewayUseCases', () => {
  let service: GatewayUseCases;
  let userRepository: SequelizeUserRepository;
  let workspaceUseCases: WorkspacesUsecases;
  let networkService: BridgeService;

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
    workspaceUseCases = module.get<WorkspacesUsecases>(WorkspacesUsecases);
    networkService = module.get<BridgeService>(BridgeService);
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
          service.updateWorkspaceStorage(v4(), maxSpaceBytes),
        ).rejects.toThrow(BadRequestException);
      });

      it('When the workspace is not found, then it should throw', async () => {
        jest.spyOn(userRepository, 'findByUuid').mockResolvedValueOnce(owner);
        jest.spyOn(workspaceUseCases, 'findOne').mockResolvedValueOnce(null);

        await expect(
          service.updateWorkspaceStorage(owner.uuid, maxSpaceBytes),
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
        const workspace = newWorkspace({
          owner,
          attributes: {
            ownerId: owner.uuid,
            workspaceUserId: workspaceUser.uuid,
          },
        });

        jest
          .spyOn(userRepository, 'findByUuid')
          .mockResolvedValueOnce(owner)
          .mockResolvedValueOnce(workspaceUser);

        jest
          .spyOn(workspaceUseCases, 'findOne')
          .mockResolvedValueOnce(workspace);

        await service.updateWorkspaceStorage(owner.uuid, maxSpaceBytes);

        expect(networkService.setStorage).toHaveBeenCalledWith(
          workspaceUserEmail,
          maxSpaceBytes,
        );
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
  });
});
