import {
  FileVersion,
  type FileVersionAttributes,
  FileVersionStatus,
} from './file-version.domain';

describe('FileVersion Domain', () => {
  const mockAttributes: FileVersionAttributes = {
    id: 'version-id-123',
    fileId: 'file-id-456',
    userId: 'user-uuid-789',
    networkFileId: 'network-file-id-789',
    size: BigInt(1024),
    status: FileVersionStatus.EXISTS,
    modificationTime: new Date('2024-01-01T00:00:00Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  it('When build is called with attributes, then it should create a FileVersion instance', () => {
    const fileVersion = FileVersion.build(mockAttributes);

    expect(fileVersion).toBeInstanceOf(FileVersion);
    expect(fileVersion.id).toBe(mockAttributes.id);
    expect(fileVersion.fileId).toBe(mockAttributes.fileId);
    expect(fileVersion.networkFileId).toBe(mockAttributes.networkFileId);
    expect(fileVersion.size).toBe(mockAttributes.size);
    expect(fileVersion.status).toBe(mockAttributes.status);
    expect(fileVersion.createdAt).toBe(mockAttributes.createdAt);
    expect(fileVersion.updatedAt).toBe(mockAttributes.updatedAt);
  });

  it('When isDeleted is called on a deleted version, then it should return true', () => {
    const deletedAttributes: FileVersionAttributes = {
      ...mockAttributes,
      status: FileVersionStatus.DELETED,
    };
    const fileVersion = FileVersion.build(deletedAttributes);

    expect(fileVersion.isDeleted()).toBe(true);
  });

  it('When isDeleted is called on an existing version, then it should return false', () => {
    const fileVersion = FileVersion.build(mockAttributes);

    expect(fileVersion.isDeleted()).toBe(false);
  });

  it('When markAsDeleted is called, then the status should change to DELETED', () => {
    const fileVersion = FileVersion.build(mockAttributes);

    expect(fileVersion.status).toBe(FileVersionStatus.EXISTS);

    fileVersion.markAsDeleted();

    expect(fileVersion.status).toBe(FileVersionStatus.DELETED);
    expect(fileVersion.isDeleted()).toBe(true);
  });

  it('When toJSON is called, then it should return all attributes', () => {
    const fileVersion = FileVersion.build(mockAttributes);

    const json = fileVersion.toJSON();

    expect(json).toEqual({
      id: mockAttributes.id,
      fileId: mockAttributes.fileId,
      userId: mockAttributes.userId,
      networkFileId: mockAttributes.networkFileId,
      size: mockAttributes.size,
      status: mockAttributes.status,
      modificationTime: mockAttributes.modificationTime,
      createdAt: mockAttributes.createdAt,
      updatedAt: mockAttributes.updatedAt,
    });
  });

  it('When toJSON is called after marking as deleted, then the status should be DELETED', () => {
    const fileVersion = FileVersion.build(mockAttributes);
    fileVersion.markAsDeleted();

    const json = fileVersion.toJSON();

    expect(json.status).toBe(FileVersionStatus.DELETED);
  });
});
