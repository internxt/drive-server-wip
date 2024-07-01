import { newWorkspaceUser } from '../../../../test/fixtures';

describe('WorkspaceUser Domain', () => {
  it('When used spaced is calculated, then it should return the correct amount', () => {
    const workspaceUser = newWorkspaceUser({
      attributes: { driveUsage: 100, backupsUsage: 200, spaceLimit: 500 },
    });
    const usedSpace = workspaceUser.getUsedSpace();

    expect(usedSpace).toEqual(300);
  });

  it('When free space is calculated, then it should return the correct amount', () => {
    const workspaceUser = newWorkspaceUser({
      attributes: { driveUsage: 100, backupsUsage: 200, spaceLimit: 500 },
    });
    const freeSpace = workspaceUser.getFreeSpace();

    expect(freeSpace).toEqual(200);
  });

  it('When drive usage is added, then it should add the assigned usage', () => {
    const workspaceUser = newWorkspaceUser({
      attributes: { driveUsage: 100, backupsUsage: 0, spaceLimit: 500 },
    });
    workspaceUser.addDriveUsage(300);

    expect(workspaceUser.driveUsage).toEqual(400);
  });

  it('When the file size is bigger than the free space, then it should return accordingly', () => {
    const workspaceUser = newWorkspaceUser({
      attributes: { driveUsage: 0, backupsUsage: 0, spaceLimit: 500 },
    });
    const isThereEnoughFreeSpace = workspaceUser.hasEnoughSpaceForFile(600);

    expect(isThereEnoughFreeSpace).toEqual(false);
  });
});
