import { Sequelize, QueryTypes } from 'sequelize';

export class FolderTestRepository {
  constructor(private readonly sequelize: Sequelize) {}

  public async getFoldersByUserId(userId: number): Promise<any[]> {
    const folders = await this.sequelize.query(
      `SELECT * FROM folders WHERE user_id = :userId`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      },
    );

    return folders;
  }

  public async createOrphan(uuid: string, userId: number): Promise<any> {
    await this.sequelize.query(
      `INSERT INTO folders (parent_id, parent_uuid, name, bucket, user_id, uuid, plain_name, encrypt_version, deleted, removed, created_at, updated_at) VALUES (:parentId, :parentUuid, :name, :bucket, :userId, :uuid, :plainName, :encryptVersion, :deleted, :removed, :createdAt, :updatedAt)`,
      {
        replacements: {
          parentId: 0,
          parentUuid: null,
          name: 'orphan folder',
          bucket: 'bucket',
          userId,
          uuid,
          plainName: 'orphan folder',
          encryptVersion: '1.0',
          deleted: false,
          removed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        type: QueryTypes.INSERT,
      },
    );
  }

  public async getBy<T = any>(key: string, value: T): Promise<any> {
    const folder = await this.sequelize.query(
      `SELECT * FROM folders WHERE ${key} = :value`,
      {
        replacements: { value },
        type: QueryTypes.SELECT,
      },
    );

    return folder[0];
  }
}
