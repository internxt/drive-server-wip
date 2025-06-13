import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { getModelToken } from '@nestjs/sequelize';
import {
  newWorkspace,
  newWorkspaceTeam,
  newWorkspaceTeamUser,
  newUser,
} from '../../../../test/fixtures';
import { WorkspaceTeamModel } from '../models/workspace-team.model';
import { SequelizeWorkspaceTeamRepository } from './team.repository';
import { WorkspaceTeam } from '../domains/workspace-team.domain';
import { WorkspaceTeamUser } from '../domains/workspace-team-user.domain';
import { WorkspaceTeamUserModel } from '../models/workspace-team-users.model';
import { v4 } from 'uuid';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('SequelizeWorkspaceTeamRepository', () => {
  let repository: SequelizeWorkspaceTeamRepository;
  let workspaceTeamModel: typeof WorkspaceTeamModel;
  let workspaceTeamUserModel: typeof WorkspaceTeamUserModel;

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
    workspaceTeamUserModel = module.get<typeof WorkspaceTeamUserModel>(
      getModelToken(WorkspaceTeamUserModel),
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

  describe('getTeamsWhereUserIsManagerByWorkspaceId', () => {
    it('should get teams where user is manager by workspace id', async () => {
      const user = newUser();
      const workspaceId = v4();
      const team = newWorkspaceTeam();
      jest
        .spyOn(workspaceTeamModel, 'findAll')
        .mockResolvedValueOnce([team as any]);

      const result = await repository.getTeamsWhereUserIsManagerByWorkspaceId(
        workspaceId,
        user,
      );

      expect(result).toEqual([team]);
    });
  });

  describe('getTeamsInWorkspace', () => {
    const workspace = newWorkspace();
    it('When a workspace id is not found then we receive an empty array', async () => {
      jest.spyOn(workspaceTeamModel, 'findAll').mockResolvedValueOnce([]);
      const response = await repository.getTeamsInWorkspace(workspace.id);
      expect(response).toEqual([]);
    });

    it('When a workspace id is found then we receive a WorkspaceTeam[]', async () => {
      const team1 = newWorkspaceTeam({ workspaceId: workspace.id });
      const team2 = newWorkspaceTeam({ workspaceId: workspace.id });

      jest
        .spyOn(workspaceTeamModel, 'findAll')
        .mockResolvedValueOnce([team1, team2] as any);

      const response = await repository.getTeamsInWorkspace(workspace.id);

      expect(response).toEqual([team1, team2]);
    });
  });

  describe('getTeamAndMemberByWorkspaceAndMemberId', () => {
    const workspace = newWorkspace();
    const member = newUser();

    it('When members are not found, then return empty array', async () => {
      jest.spyOn(workspaceTeamUserModel, 'findAll').mockResolvedValueOnce([]);

      const result = await repository.getTeamAndMemberByWorkspaceAndMemberId(
        workspace.id,
        member.uuid,
      );

      expect(result).toEqual([]);
    });

    it('When members are found, then return member data and team', async () => {
      const teamRaw = newWorkspaceTeam();
      const workspaceTeamUserRaw = newWorkspaceTeamUser({ teamId: teamRaw.id });

      jest.spyOn(workspaceTeamUserModel, 'findAll').mockResolvedValueOnce([
        {
          ...workspaceTeamUserRaw.toJSON(),
          toJSON: jest.fn().mockReturnValue(workspaceTeamUserRaw),
          team: {
            ...teamRaw.toJSON(),
            toJSON: jest.fn().mockReturnValue(teamRaw),
          },
        },
      ] as any);

      const result = await repository.getTeamAndMemberByWorkspaceAndMemberId(
        workspace.id,
        member.uuid,
      );

      expect(result).toEqual([
        { team: teamRaw, teamUser: workspaceTeamUserRaw },
      ]);
    });
  });

  describe('getTeamsUserBelongsTo', () => {
    it('When teams are not found, then return an empty array', async () => {
      const memberId = v4();
      const workspaceId = v4();

      jest.spyOn(workspaceTeamUserModel, 'findAll').mockResolvedValueOnce([]);

      const result = await repository.getTeamsUserBelongsTo(
        memberId,
        workspaceId,
      );

      expect(result).toEqual([]);
    });

    it('When teams are found, then return the teams the user belongs to', async () => {
      const memberId = v4();
      const workspaceId = v4();
      const team = newWorkspaceTeam({ workspaceId });
      const teamUser = newWorkspaceTeamUser({ memberId, teamId: team.id });

      jest.spyOn(workspaceTeamUserModel, 'findAll').mockResolvedValueOnce([
        {
          ...teamUser.toJSON(),
          toJSON: jest.fn().mockReturnValue(teamUser),
          team: {
            ...team.toJSON(),
            toJSON: jest.fn().mockReturnValue(team),
          },
        },
      ] as any);

      const result = await repository.getTeamsUserBelongsTo(
        memberId,
        workspaceId,
      );

      expect(result).toEqual([expect.any(WorkspaceTeam)]);
      expect(result[0].id).toEqual(team.id);
    });
  });

  describe('addUserToTeam', () => {
    it('when a user is added to a team then return the team user', async () => {
      const teamId = v4();
      const userUuid = v4();
      const teamUser = newWorkspaceTeamUser({ memberId: userUuid, teamId });

      jest.spyOn(workspaceTeamUserModel, 'create').mockResolvedValueOnce({
        ...teamUser,
        toJSON: jest.fn().mockReturnValue(teamUser.toJSON()),
      } as any);

      const result = await repository.addUserToTeam(teamId, userUuid);

      expect(result).toEqual(teamUser);
      expect(workspaceTeamUserModel.create).toHaveBeenCalledWith({
        teamId,
        memberId: userUuid,
      });
    });

    it('when unique constraint is violated ', async () => {
      const teamId = v4();
      const userUuid = v4();

      const sequelizeError = {
        name: 'SequelizeUniqueConstraintError',
        original: {
          constraint: 'workspace_teams_users_member_id_team_id_key',
        },
      };

      jest
        .spyOn(workspaceTeamUserModel, 'create')
        .mockRejectedValueOnce(sequelizeError);

      await expect(repository.addUserToTeam(teamId, userUuid)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
