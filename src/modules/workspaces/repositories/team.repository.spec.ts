import { Test, type TestingModule } from '@nestjs/testing';
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
import { UserModel } from '../../user/user.model';
import { User } from '../../user/user.domain';

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

  describe('getTeamMembers', () => {
    it('When getting team members, then return users who belong to the team', async () => {
      const teamId = v4();
      const user1 = newUser();
      const user2 = newUser();
      const mockTeamUsers = [
        {
          member: {
            get: jest.fn().mockReturnValue(user1),
          },
        },
        {
          member: {
            get: jest.fn().mockReturnValue(user2),
          },
        },
      ];

      jest
        .spyOn(workspaceTeamUserModel, 'findAll')
        .mockResolvedValueOnce(mockTeamUsers as any);

      const result = await repository.getTeamMembers(teamId);

      expect(workspaceTeamUserModel.findAll).toHaveBeenCalledWith({
        where: { teamId },
        include: { model: UserModel, required: true },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(User);
    });
  });

  describe('getTeamMembersCount', () => {
    it('When getting team members count, then return the count', async () => {
      const teamId = v4();
      const expectedCount = 5;

      jest
        .spyOn(workspaceTeamUserModel, 'count')
        .mockResolvedValueOnce(expectedCount);

      const result = await repository.getTeamMembersCount(teamId);

      expect(workspaceTeamUserModel.count).toHaveBeenCalledWith({
        where: { id: teamId },
      });
      expect(result).toEqual(expectedCount);
    });

    it('When count returns null, then return 0', async () => {
      const teamId = v4();

      jest.spyOn(workspaceTeamUserModel, 'count').mockResolvedValueOnce(null);

      const result = await repository.getTeamMembersCount(teamId);

      expect(result).toEqual(0);
    });
  });

  describe('getTeamUser', () => {
    it('When team user is found, then return the team user', async () => {
      const userUuid = v4();
      const teamId = v4();
      const mockTeamUser = newWorkspaceTeamUser();

      jest
        .spyOn(workspaceTeamUserModel, 'findOne')
        .mockResolvedValueOnce(mockTeamUser as any);

      const result = await repository.getTeamUser(userUuid, teamId);

      expect(workspaceTeamUserModel.findOne).toHaveBeenCalledWith({
        where: { memberId: userUuid, teamId },
      });
      expect(result).toBeInstanceOf(WorkspaceTeamUser);
    });

    it('When team user is not found, then return null', async () => {
      const userUuid = v4();
      const teamId = v4();

      jest.spyOn(workspaceTeamUserModel, 'findOne').mockResolvedValueOnce(null);

      const result = await repository.getTeamUser(userUuid, teamId);

      expect(result).toBeNull();
    });
  });

  describe('removeMemberFromTeam', () => {
    it('When removing member from team, then call destroy method', async () => {
      const teamId = v4();
      const memberId = v4();

      await repository.removeMemberFromTeam(teamId, memberId);

      expect(workspaceTeamUserModel.destroy).toHaveBeenCalledWith({
        where: { teamId, memberId },
      });
    });
  });

  describe('addUserToTeam', () => {
    it('When adding user to team, then create and return team user', async () => {
      const teamId = v4();
      const userUuid = v4();
      const mockTeamUser = newWorkspaceTeamUser({ teamId, memberId: userUuid });

      jest
        .spyOn(workspaceTeamUserModel, 'create')
        .mockResolvedValueOnce(mockTeamUser as any);

      const result = await repository.addUserToTeam(teamId, userUuid);

      expect(workspaceTeamUserModel.create).toHaveBeenCalledWith({
        teamId,
        memberId: userUuid,
      });
      expect(result).toBeInstanceOf(WorkspaceTeamUser);
    });
  });

  describe('deleteUserFromTeam', () => {
    it('When deleting user from team, then call destroy method', async () => {
      const memberId = v4();
      const teamId = v4();

      await repository.deleteUserFromTeam(memberId, teamId);

      expect(workspaceTeamUserModel.destroy).toHaveBeenCalledWith({
        where: { memberId, teamId },
      });
    });
  });

  describe('getTeamsAndMembersCountByWorkspace', () => {
    it('When getting teams and members count, then return teams with member counts', async () => {
      const workspaceId = v4();
      const mockTeams = [
        {
          ...newWorkspaceTeam().toJSON(),
          dataValues: { membersCount: '3' },
          toJSON: jest.fn().mockReturnValue(newWorkspaceTeam().toJSON()),
        },
        {
          ...newWorkspaceTeam().toJSON(),
          dataValues: { membersCount: '5' },
          toJSON: jest.fn().mockReturnValue(newWorkspaceTeam().toJSON()),
        },
      ];

      jest
        .spyOn(workspaceTeamModel, 'findAll')
        .mockResolvedValueOnce(mockTeams as any);

      const result =
        await repository.getTeamsAndMembersCountByWorkspace(workspaceId);

      expect(result).toHaveLength(2);
      expect(result[0].team).toBeInstanceOf(WorkspaceTeam);
      expect(result[0].membersCount).toEqual(3);
      expect(result[1].membersCount).toEqual(5);
    });
  });

  describe('getTeamsInWorkspaceCount', () => {
    it('When getting teams count in workspace, then return the count', async () => {
      const workspaceId = v4();
      const expectedCount = 4;

      jest
        .spyOn(workspaceTeamModel, 'count')
        .mockResolvedValueOnce(expectedCount);

      const result = await repository.getTeamsInWorkspaceCount(workspaceId);

      expect(workspaceTeamModel.count).toHaveBeenCalledWith({
        where: { workspaceId },
      });
      expect(result).toEqual(expectedCount);
    });
  });

  describe('deleteTeamById', () => {
    it('When deleting team by ID, then call destroy method', async () => {
      const teamId = v4();

      await repository.deleteTeamById(teamId);

      expect(workspaceTeamModel.destroy).toHaveBeenCalledWith({
        where: { id: teamId },
      });
    });
  });
});
