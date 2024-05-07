import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { getModelToken } from '@nestjs/sequelize';
import {
  newWorkspaceTeam,
  newWorkspaceTeamUser,
} from '../../../../test/fixtures';
import { WorkspaceTeamModel } from '../models/workspace-team.model';
import { SequelizeWorkspaceTeamRepository } from './team.repository';
import { WorkspaceTeam } from '../domains/workspace-team.domain';
import { WorkspaceTeamUser } from '../domains/workspace-team-user.domain';

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

      jest.spyOn(workspaceTeamModel, 'create').mockResolvedValueOnce({
        toJSON: jest.fn().mockReturnValue({ ...team.toJSON() }),
      } as any);

      const teamCreated = await repository.createTeam(team);

      expect(teamCreated.id).toEqual(team.id);
    });
  });

  describe('updateById', () => {
    it('should update a team by id', async () => {
      const id = '1';
      const update = { name: 'new name' };
      jest.spyOn(workspaceTeamModel, 'update').mockResolvedValueOnce(null);

      await repository.updateById(id, update);

      expect(workspaceTeamModel.update).toHaveBeenCalledWith(update, {
        where: { id },
      });
    });
  });

  describe('getTeamUserAndTeamByTeamId', () => {
    it('When team and team member are found, then it should return both', async () => {
      const team = newWorkspaceTeam();
      const teamUser = newWorkspaceTeamUser({ teamId: team.id });
      const mockTeamUser = {
        ...teamUser.toJSON(),
      };
      const mockTeam = {
        ...team.toJSON(),
      };

      jest.spyOn(workspaceTeamModel, 'findOne').mockResolvedValueOnce({
        ...mockTeam,
        toJSON: jest.fn().mockReturnValue(mockTeam),
        teamUsers: [
          {
            ...mockTeamUser,
            toJSON: jest.fn().mockReturnValue(mockTeamUser),
          },
        ],
      } as any);

      const result = await repository.getTeamUserAndTeamByTeamId(
        'userUuid',
        'teamId',
      );

      expect(result).toEqual({
        team: expect.any(WorkspaceTeam),
        teamUser: expect.any(WorkspaceTeamUser),
      });

      expect(result.team.id).toEqual(team.id);
      expect(result.teamUser.id).toEqual(teamUser.id);
    });

    it('When team is found but team member is missing, then it should return only team', async () => {
      const team = newWorkspaceTeam();
      const mockTeam = {
        ...team.toJSON(),
      };

      jest.spyOn(workspaceTeamModel, 'findOne').mockResolvedValueOnce({
        ...mockTeam,
        toJSON: jest.fn().mockReturnValue(mockTeam),
      } as any);

      const result = await repository.getTeamUserAndTeamByTeamId(
        'userUuid',
        'teamId',
      );

      expect(result.team.id).toEqual(team.id);
      expect(result.teamUser).toBeNull();
    });
  });

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
});
