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

    it('When owner does not exist, then it should throw', async () => {
      jest
        .spyOn(workspaceUseCases, 'initiateWorkspace')
        .mockRejectedValueOnce(new BadRequestException());

      const initializeWorkspaceDto: InitializeWorkspaceDto = {
        ownerId: owner.uuid,
        maxSpaceBytes,
        address: workspaceAddress,
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
        },
      });
      jest
        .spyOn(workspaceUseCases, 'initiateWorkspace')
        .mockResolvedValueOnce({ workspace: createdWorkspace });
      const initializeWorkspaceDto: InitializeWorkspaceDto = {
        ownerId: owner.uuid,
        maxSpaceBytes,
        address: workspaceAddress,
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

      it('When workspaces are not found, then it should throw', async () => {
        jest.spyOn(userRepository, 'findByUuid').mockResolvedValueOnce(owner);
        jest
          .spyOn(workspaceUseCases, 'findByOwnerId')
          .mockResolvedValueOnce([]);

        await expect(
          service.updateWorkspaceStorage(owner.uuid, maxSpaceBytes),
        ).rejects.toThrow(NotFoundException);
      });

      it('When owner and workspaces are found, then it should update the workspaces completed', async () => {
        const userWorkspaceEmail = 'user@workspace.com';
        const userWorkspace = newUser({
          attributes: { email: userWorkspaceEmail },
        });
        const workspaceIncompleted = newWorkspace({
          owner,
          attributes: {
            ownerId: owner.uuid,
            setupCompleted: false,
          },
        });
        const workspaceCompleted = newWorkspace({
          owner,
          attributes: {
            ownerId: owner.uuid,
            workspaceUserId: userWorkspace.uuid,
          },
        });

        jest
          .spyOn(userRepository, 'findByUuid')
          .mockResolvedValueOnce(owner)
          .mockResolvedValueOnce(userWorkspace);

        jest
          .spyOn(workspaceUseCases, 'findByOwnerId')
          .mockResolvedValueOnce([workspaceIncompleted, workspaceCompleted]);

        await service.updateWorkspaceStorage(owner.uuid, maxSpaceBytes);

        expect(networkService.setStorage).toHaveBeenCalledWith(
          userWorkspaceEmail,
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

      it('When workspace are not found, then it should throw', async () => {
        jest.spyOn(workspaceUseCases, 'findByOwnerId').mockResolvedValue([]);

        await expect(service.destroyWorkspace(owner.uuid)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('When owner and workspaces are found, then it should delete all workspaces completed', async () => {
        const workspaceIncompleted = newWorkspace({
          owner,
          attributes: { ownerId: owner.uuid, setupCompleted: false },
        });
        const workspaceCompleted = newWorkspace({
          owner,
          attributes: { ownerId: owner.uuid },
        });

        jest
          .spyOn(workspaceUseCases, 'findByOwnerId')
          .mockResolvedValue([workspaceIncompleted, workspaceCompleted]);

        await service.destroyWorkspace(owner.uuid);

        expect(
          workspaceUseCases.deleteWorkspaceContent,
        ).not.toHaveBeenCalledWith(workspaceIncompleted.id, owner);

        expect(workspaceUseCases.deleteWorkspaceContent).toHaveBeenCalledWith(
          workspaceCompleted.id,
          owner,
        );
      });
    });
  });
});
