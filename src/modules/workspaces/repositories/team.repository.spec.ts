import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { getModelToken } from '@nestjs/sequelize';
import { newWorkspaceTeam } from '../../../../test/fixtures';
import { WorkspaceTeamModel } from '../models/workspace-team.model';
import { SequelizeWorkspaceTeamRepository } from './team.repository';
import { Transaction } from 'sequelize';

describe('SequelizeWorkspaceTeamRepository', () => {
  let repository: SequelizeWorkspaceTeamRepository;
  let workspaceTeamModel: typeof WorkspaceTeamModel;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequelizeWorkspaceTeamRepository],
    })
      .useMocker(() => createMock())
      .compile();

    repository = module.get<SequelizeWorkspaceTeamRepository>(
      SequelizeWorkspaceTeamRepository,
    );
    workspaceTeamModel = module.get<typeof WorkspaceTeamModel>(
      getModelToken(WorkspaceTeamModel),
    );
  });

  describe('createTeam', () => {
    it('should create a team', async () => {
      const team = newWorkspaceTeam();
      const raw = newWorkspaceTeam();
      jest
        .spyOn(workspaceTeamModel, 'create')
        .mockResolvedValueOnce(raw as any);

      const result = await repository.createTeam(team);

      expect(result).toEqual(team);
    });
  });

  describe('updateById', () => {
    it('should update a team by id', async () => {
      const id = '1';
      const update = { name: 'new name' };
      jest.spyOn(workspaceTeamModel, 'update').mockResolvedValueOnce(null);

      await repository.updateById(id, update);

      expect(workspaceTeamModel.update).toBeCalledWith(update, {
        where: { id },
      });
    });
  });

  describe('getTeamMembers', () => {
    it('should get team members', async () => {
      const teamId = '1';
      const raw = newWorkspaceTeam();
      jest
        .spyOn(workspaceTeamModel, 'findAll')
        .mockResolvedValueOnce([raw] as any);

      const result = await repository.getTeamMembers(teamId);

      expect(result).toEqual([raw]);
    });
  });

  describe('getTeamUserAndTeamByTeamId', () => {
    it('should get team user and team by team id', async () => {
      const userUuid = '1';
      const teamId = '1';
      const team = newWorkspaceTeam();
      jest
        .spyOn(workspaceTeamModel, 'findOne')
        .mockResolvedValueOnce(team as any);

      const result = await repository.getTeamUserAndTeamByTeamId(
        userUuid,
        teamId,
      );

      expect(result).toEqual({ team, teamUser: team.teamUsers[0] });
    });
  });

  // describe('toDomain', () => {
  //   it('should convert raw team to domain', () => {
  //     const raw = newWorkspaceTeam();
  //     const result = repository.toDomain(raw);

  //     expect(result).toEqual(raw);
  //   });
  // });

  describe('getTeamById', () => {
    it('should get team by id', async () => {
      const teamId = '1';
      const raw = newWorkspaceTeam();
      jest
        .spyOn(workspaceTeamModel, 'findOne')
        .mockResolvedValueOnce(raw as any);

      const result = await repository.getTeamById(teamId);

      expect(result).toEqual(raw);
    });
  });

  describe('removeMemberFromTeam', () => {
    it('should remove member from team', async () => {
      const teamId = '1';
      const memberId = '1';
      jest.spyOn(workspaceTeamModel, 'update').mockResolvedValueOnce(null);

      await repository.removeMemberFromTeam(teamId, memberId);

      expect(workspaceTeamModel.update).toBeCalledWith(
        { memberId: null },
        { where: { id: teamId, memberId } },
      );
    });

    it('should error when trying to remove a member that doesnt exist', async () => {
      const teamId = '1';
      const memberId = '1';
      jest.spyOn(workspaceTeamModel, 'update').mockResolvedValueOnce(null);

      await expect(
        repository.removeMemberFromTeam(teamId, memberId),
      ).rejects.toThrowError();
    });
  });

  describe('addMemberToTeam', () => {
    it('should add member to team', async () => {
      const teamId = '1';
      const memberId = '1';
      jest.spyOn(workspaceTeamModel, 'update').mockResolvedValueOnce(null);

      await repository.addMemberToTeam(teamId, memberId);

      expect(workspaceTeamModel.update).toBeCalledWith(
        { memberId },
        { where: { id: teamId } },
      );
    });

    it('should add member to team with transaction', async () => {
      const teamId = '1';
      const memberId = '1';
      const transaction = createMock<Transaction>();
      jest.spyOn(workspaceTeamModel, 'update').mockResolvedValueOnce(null);

      await repository.addMemberToTeam(teamId, memberId, transaction);

      expect(workspaceTeamModel.update).toBeCalledWith(
        { memberId },
        { where: { id: teamId }, transaction },
      );
    });
  });

  // describe('teamUserToDomain', () => {
  //   it('should convert raw team user to domain', () => {
  //     const raw = newWorkspaceTeam();
  //     const result = repository.teamUserToDomain(raw);

  //     expect(result).toEqual(raw);
  //   });
  // });
});
