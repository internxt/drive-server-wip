import {
  LimitLabels,
  LimitTypes,
} from '../src/modules/feature-limit/limits.enum';
import { FileStatus } from '../src/modules/file/file.domain';
import {
  WorkspaceItemContext,
  WorkspaceItemType,
} from '../src/modules/workspaces/attributes/workspace-items-users.attributes';
import * as fixtures from './fixtures';

describe('Testing fixtures tests', () => {
  describe("User's fixture", () => {
    it('When it generates a user, then the identifier should be random', () => {
      const user = fixtures.newUser();
      const otherUser = fixtures.newUser();

      expect(user.id).toBeGreaterThan(0);
      expect(user.id).not.toBe(otherUser.id);
    });

    it('When it generates a user, then the uuid should be random', () => {
      const user = fixtures.newUser();
      const otherUser = fixtures.newUser();

      expect(user.uuid).not.toBe(otherUser.uuid);
    });

    it('When it generates a user, then the email should be random', () => {
      const user = fixtures.newUser();
      const otherUser = fixtures.newUser();

      expect(user.email).not.toBe(otherUser.email);
    });

    it('When it generates a user, then the rootFolderId should be random', () => {
      const user = fixtures.newUser();
      const otherUser = fixtures.newUser();

      expect(user.rootFolderId).not.toBe(otherUser.rootFolderId);
    });
  });

  describe("Folder's fixture", () => {
    it('When it generates a folder, then the identifier should be random', () => {
      const folder = fixtures.newFolder();
      const otherFolder = fixtures.newFolder();

      expect(folder.id).toBeGreaterThan(0);
      expect(folder.id).not.toBe(otherFolder.id);
    });

    it('When it generates a folder, then the uuid should be random', () => {
      const folder = fixtures.newFolder();
      const otherFolder = fixtures.newFolder();

      expect(folder.uuid).not.toBe(otherFolder.uuid);
    });

    it('When it generates a folder, then the parentId should be random', () => {
      const folder = fixtures.newFolder();
      const otherFolder = fixtures.newFolder();

      expect(folder.parentId).not.toBe(otherFolder.parentId);
    });

    it('When it generates a folder with owner, then the userId should be the owner id', () => {
      const owner = fixtures.newUser();
      const folder = fixtures.newFolder({ owner });

      expect(folder.userId).toBe(owner.id);
    });

    it('When it generates a folder without owner, then the userId should be random', () => {
      const folder = fixtures.newFolder();
      const otherFolder = fixtures.newFolder();

      expect(folder.userId).not.toEqual(otherFolder.userId);
    });

    it('When it generates a folder, then the createdAt should be equal or less than updatedAt', () => {
      const folder = fixtures.newFolder();

      expect(folder.createdAt.getTime()).toBeLessThanOrEqual(
        folder.updatedAt.getTime(),
      );
    });

    it(`When it generates a folder, then the bucket length is ${fixtures.constants.BUCKET_ID_LENGTH}`, () => {
      const folder = fixtures.newFolder();

      expect(folder.bucket.length).toBe(fixtures.constants.BUCKET_ID_LENGTH);
    });

    it('When it generates a folder, then the bucket should be random', () => {
      const folder = fixtures.newFolder();
      const otherFolder = fixtures.newFolder();

      expect(folder.bucket).not.toBe(otherFolder.bucket);
    });

    it('When it generates a folder, then the plainName should be random', () => {
      const folder = fixtures.newFolder();
      const otherFolder = fixtures.newFolder();

      expect(folder.plainName).not.toBe(otherFolder.plainName);
    });

    it('When it generates a folder and settable attributes are provided, then those attributes are set', () => {
      const settableAttributes: fixtures.FolderSettableAttributes = {
        deleted: true,
        deletedAt: new Date(),
        removed: true,
        removedAt: new Date(),
      };
      const folder = fixtures.newFolder({
        attributes: settableAttributes,
      });

      expect(folder.deleted).toBe(settableAttributes.deleted);
      expect(folder.deletedAt).toBe(settableAttributes.deletedAt);
      expect(folder.removed).toBe(settableAttributes.removed);
      expect(folder.removedAt).toBe(settableAttributes.removedAt);
    });
  });

  describe("Files's fixture", () => {
    it('When it generates a file, then the identifier should be random', () => {
      const file = fixtures.newFile();
      const otherFile = fixtures.newFile();

      expect(file.id).toBeGreaterThan(0);
      expect(file.id).not.toBe(otherFile.id);
    });

    it('When it generates a file, then the uuid should be random', () => {
      const file = fixtures.newFile();
      const otherFile = fixtures.newFile();

      expect(file.uuid).not.toBe(otherFile.uuid);
    });

    it('When it generates a file with owner, then the userId should be the owner id', () => {
      const owner = fixtures.newUser();
      const file = fixtures.newFile({ owner });

      expect(file.userId).toBe(owner.id);
    });

    it('When it generates a file without owner, then the userId should be random', () => {
      const file = fixtures.newFile();
      const otherFile = fixtures.newFile();

      expect(file.userId).not.toEqual(otherFile.userId);
    });

    it('When it generates a file, then the createdAt should be equal or less than updatedAt', () => {
      const file = fixtures.newFile();

      expect(file.createdAt.getTime()).toBeLessThanOrEqual(
        file.updatedAt.getTime(),
      );
    });

    it(`When it generates a file, then the bucket length is ${fixtures.constants.BUCKET_ID_LENGTH}`, () => {
      const file = fixtures.newFile();

      expect(file.bucket.length).toBe(fixtures.constants.BUCKET_ID_LENGTH);
    });

    it('When it generates a file, then the bucket should be random', () => {
      const file = fixtures.newFile();
      const otherFile = fixtures.newFile();

      expect(file.bucket).not.toBe(otherFile.bucket);
    });

    it('When it generates a file, then the plainName should be random', () => {
      const file = fixtures.newFile();
      const otherFile = fixtures.newFile();

      expect(file.plainName).not.toBe(otherFile.plainName);
    });

    it('When it generates a file and settable attributes are provided, then those attributes are set', () => {
      const settableAttributes: fixtures.FilesSettableAttributes = {
        deleted: true,
        deletedAt: new Date(),
        removed: true,
        removedAt: new Date(),
        status: FileStatus.DELETED,
      };
      const file = fixtures.newFile({
        attributes: settableAttributes,
      });

      expect(file.deleted).toBe(settableAttributes.deleted);
      expect(file.deletedAt).toBe(settableAttributes.deletedAt);
      expect(file.removed).toBe(settableAttributes.removed);
      expect(file.removed).toBe(settableAttributes.removed);
      expect(file.status).toBe(settableAttributes.status);
    });

    it('When it generates a file and a folder is provided, then that folder should be set', () => {
      const folder = fixtures.newFolder();
      const file = fixtures.newFile({
        folder,
      });

      expect(file.folder).toEqual(folder);
      expect(file.folderId).toEqual(folder.id);
      expect(file.folderUuid).toEqual(folder.uuid);
    });
  });

  describe('Mail Limits fixture', () => {
    it('When it generates a new mail limit, then the identifier should be random', () => {
      const mailLimit = fixtures.newMailLimit();
      const otherMailLimit = fixtures.newMailLimit();

      expect(mailLimit.id).toBeGreaterThan(0);
      expect(otherMailLimit.id).not.toBe(mailLimit.id);
    });

    it('When it generates a new mail limit and a date is provided, then that date should be set', () => {
      const date = new Date();
      const mailLimit = fixtures.newMailLimit({ lastMailSent: date });

      expect(mailLimit.lastMailSent).toEqual(date);
    });

    it('When it generates a new mail limit and attemps count are provided, then those attemps should be set', () => {
      const mailLimit = fixtures.newMailLimit({ attemptsCount: 5 });

      expect(mailLimit.attemptsCount).toEqual(5);
    });

    it('When it generates a new mail limit and attempts limits are provided, then those limits should be set', () => {
      const mailLimit = fixtures.newMailLimit({ attemptsLimit: 5 });

      expect(mailLimit.attemptsLimit).toEqual(5);
    });
  });

  describe('Feature limit fixture', () => {
    it('When it generates a new limit, then the identifier should be random', () => {
      const limit = fixtures.newFeatureLimit();
      const otherLimit = fixtures.newFeatureLimit();

      expect(limit.id).toBeTruthy();
      expect(otherLimit.id).not.toBe(limit.id);
    });

    it('When it generates a limit and a label is provided, then that label should be set', () => {
      const limit = fixtures.newFeatureLimit({
        label: 'anyLabel' as LimitLabels,
        type: LimitTypes.Boolean,
        value: '0',
      });

      expect(limit.label).toEqual('anyLabel');
    });

    it('When it generates a limit and a type and value are provided, then that those fields should be set', () => {
      const limit = fixtures.newFeatureLimit({
        type: LimitTypes.Boolean,
        value: '0',
      });

      expect(limit.type).toEqual(LimitTypes.Boolean);
      expect(limit.value).toEqual('0');
    });
  });

  describe("Workspace's fixture", () => {
    it('When it generates a workspace, then the identifier should be random', () => {
      const workspace = fixtures.newWorkspace();
      const otherWorkspace = fixtures.newWorkspace();

      expect(workspace.id).toBeTruthy();
      expect(workspace.id).not.toBe(otherWorkspace.id);
    });

    it('When it generates a workspace, then the ownerId should be random', () => {
      const workspace = fixtures.newWorkspace();
      const otherWorkspace = fixtures.newWorkspace();

      expect(workspace.ownerId).toBeTruthy();
      expect(workspace.ownerId).not.toBe(otherWorkspace.ownerId);
    });

    it('When it generates a workspace with an owner, then the ownerId should match the owner', () => {
      const owner = fixtures.newUser();
      const workspace = fixtures.newWorkspace({ owner });

      expect(workspace.ownerId).toBe(owner.uuid);
    });

    it('When it generates a workspace, then the createdAt should be equal or less than updatedAt', () => {
      const workspace = fixtures.newWorkspace();

      expect(workspace.createdAt.getTime()).toBeLessThanOrEqual(
        workspace.updatedAt.getTime(),
      );
    });

    it('When it generates a workspace, then the setupCompleted should be a boolean value', () => {
      const workspace = fixtures.newWorkspace();

      expect(typeof workspace.setupCompleted).toBe('boolean');
    });
  });

  describe("WorkspaceTeam's fixture", () => {
    it('When it generates a workspace team, then the identifier should be random', () => {
      const team = fixtures.newWorkspaceTeam();
      const otherTeam = fixtures.newWorkspaceTeam();

      expect(team.id).toBeTruthy();
      expect(team.id).not.toBe(otherTeam.id);
    });

    it('When it generates a workspace team, then the workspaceId should be random', () => {
      const team = fixtures.newWorkspaceTeam();
      const otherTeam = fixtures.newWorkspaceTeam();

      expect(team.workspaceId).toBeTruthy();
      expect(team.workspaceId).not.toBe(otherTeam.workspaceId);
    });

    it('When it generates a workspace team with a manager, then the managerId should match the manager', () => {
      const manager = fixtures.newUser();
      const team = fixtures.newWorkspaceTeam({ manager });

      expect(team.managerId).toBe(manager.uuid);
    });

    it('When it generates a workspace team, then the createdAt should be equal or less than updatedAt', () => {
      const team = fixtures.newWorkspaceTeam();

      expect(team.createdAt.getTime()).toBeLessThanOrEqual(
        team.updatedAt.getTime(),
      );
    });

    it('When it generates a workspace team, then the name should be populated', () => {
      const team = fixtures.newWorkspaceTeam();

      expect(team.name).toBeTruthy();
      expect(typeof team.name).toBe('string');
    });
  });

  describe("WorkspaceUser's fixture", () => {
    it('When it generates a workspace user, then the identifier should be random', () => {
      const user = fixtures.newWorkspaceUser();
      const otherUser = fixtures.newWorkspaceUser();
      expect(user.id).toBeTruthy();
      expect(user.id).not.toBe(otherUser.id);
    });

    it('When it generates a workspace user, then the workspaceId should be random', () => {
      const user = fixtures.newWorkspaceUser();
      const otherUser = fixtures.newWorkspaceUser();
      expect(user.workspaceId).toBeTruthy();
      expect(user.workspaceId).not.toBe(otherUser.workspaceId);
    });

    it('When it generates a workspace user with a specified memberId, then the memberId should match', () => {
      const memberId = 'anyId';
      const user = fixtures.newWorkspaceUser({ memberId });
      expect(user.memberId).toBe(memberId);
    });

    it('When it generates a workspace user, then driveUsage and backupsUsage should not exceed spaceLimit', () => {
      const user = fixtures.newWorkspaceUser();
      expect(Number(user.driveUsage)).toBeLessThanOrEqual(
        BigInt(user.spaceLimit),
      );
      expect(BigInt(user.backupsUsage)).toBeLessThanOrEqual(
        BigInt(user.spaceLimit),
      );
    });

    it('When it generates a workspace user with custom attributes, then those attributes are set correctly', () => {
      const customAttributes = {
        deactivated: true,
        spaceLimit: BigInt(500),
      };
      const user = fixtures.newWorkspaceUser({ attributes: customAttributes });

      expect(user.deactivated).toBe(customAttributes.deactivated);
      expect(user.spaceLimit).toBe(customAttributes.spaceLimit);
    });
  });

  describe("WorkspaceInvite's fixture", () => {
    it('When it generates a workspace invite, then the identifier should be random', () => {
      const invite = fixtures.newWorkspaceInvite();
      const otherInvite = fixtures.newWorkspaceInvite();
      expect(invite.id).toBeTruthy();
      expect(invite.id).not.toBe(otherInvite.id);
    });

    it('When it generates a workspace invite, then the workspaceId should be random', () => {
      const invite = fixtures.newWorkspaceInvite();
      const otherInvite = fixtures.newWorkspaceInvite();
      expect(invite.workspaceId).toBeTruthy();
      expect(invite.workspaceId).not.toBe(otherInvite.workspaceId);
    });

    it('When it generates a workspace invite with a specified invitedUser, then the invitedUser should match', () => {
      const invitedUser = 'test@example.com';
      const invite = fixtures.newWorkspaceInvite({ invitedUser });
      expect(invite.invitedUser).toBe(invitedUser);
    });

    it('When it generates a workspace invite with custom attributes, then those attributes are set correctly', () => {
      const customAttributes = {
        encryptionAlgorithm: 'AES-256',
        spaceLimit: BigInt(2048),
      };
      const invite = fixtures.newWorkspaceInvite({
        attributes: customAttributes,
      });

      expect(invite.encryptionAlgorithm).toBe(
        customAttributes.encryptionAlgorithm,
      );
      expect(invite.spaceLimit).toBe(customAttributes.spaceLimit);
    });
  });

  describe("newWorkspaceTeamUser's fixture", () => {
    it('When it generates a team user, then the identifier should be random', () => {
      const teamUser = fixtures.newWorkspaceTeamUser();
      const otherTeamUser = fixtures.newWorkspaceTeamUser();
      expect(teamUser.id).toBeTruthy();
      expect(teamUser.id).not.toBe(otherTeamUser.id);
    });

    it('When it generates a team user, then the teamId should be random', () => {
      const teamUser = fixtures.newWorkspaceTeamUser();
      const otherTeamUser = fixtures.newWorkspaceTeamUser();
      expect(teamUser.teamId).toBeTruthy();
      expect(teamUser.teamId).not.toBe(otherTeamUser.teamId);
    });

    it('When it generates a workspace with a specified memberId, then the memberId should match', () => {
      const memberId = 'customId';
      const teamUser = fixtures.newWorkspaceTeamUser({ memberId });
      expect(teamUser.memberId).toBe(memberId);
    });

    it('When it generates a team user with custom attributes, then those attributes are set correctly', () => {
      const customAttributes = {
        memberId: 'memberIdCustom',
        teamId: 'customTeamId',
      };
      const teamUser = fixtures.newWorkspaceTeamUser({
        attributes: customAttributes,
      });

      expect(teamUser.memberId).toBe(customAttributes.memberId);
      expect(teamUser.teamId).toBe(customAttributes.teamId);
    });
  });

  describe("WorkspaceItemUser's fixture", () => {
    it('When it generates a workspace item user, then the identifier should be random', () => {
      const itemUser = fixtures.newWorkspaceItemUser();
      const otherItemUser = fixtures.newWorkspaceItemUser();

      expect(itemUser.id).toBeTruthy();
      expect(itemUser.id).not.toBe(otherItemUser.id);
    });

    it('When it generates a workspace item user, then the workspaceId should be random', () => {
      const itemUser = fixtures.newWorkspaceItemUser();
      const otherItemUser = fixtures.newWorkspaceItemUser();

      expect(itemUser.workspaceId).toBeTruthy();
      expect(itemUser.workspaceId).not.toBe(otherItemUser.workspaceId);
    });

    it('When it generates a workspace item user, then the itemType should be populated', () => {
      const itemUser = fixtures.newWorkspaceItemUser();
      expect(itemUser.itemType).toBeTruthy();
      expect(Object.values(WorkspaceItemType)).toContain(itemUser.itemType);
    });

    it('When it generates a workspace item user, then the context should be populated', () => {
      const itemUser = fixtures.newWorkspaceItemUser();
      expect(itemUser.context).toBeTruthy();
      expect(Object.values(WorkspaceItemContext)).toContain(itemUser.context);
    });

    it('When it generates a workspace item user with a specified creator, then the createdBy should match', () => {
      const createdBy = 'customCreatedBy';
      const itemUser = fixtures.newWorkspaceItemUser({ createdBy });
      expect(itemUser.createdBy).toBe(createdBy);
    });

    it('When it generates a workspace item user with custom attributes, then those attributes are set correctly', () => {
      const customAttributes = {
        itemType: WorkspaceItemType.File,
        context: WorkspaceItemContext.Backup,
      };
      const itemUser = fixtures.newWorkspaceItemUser({
        attributes: customAttributes,
      });

      expect(itemUser.itemType).toBe(customAttributes.itemType);
      expect(itemUser.context).toBe(customAttributes.context);
    });
  });
});
