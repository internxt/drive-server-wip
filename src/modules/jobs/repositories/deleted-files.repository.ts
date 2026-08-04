import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes, Sequelize } from 'sequelize';

export interface DeletedFilesRepository {
  findUpdatedBefore(cutoffDate: Date, limit: number): Promise<string[]>;
  destroyByFileIds(fileIds: string[]): Promise<number>;
}

@Injectable()
export class SequelizeDeletedFilesRepository
  implements DeletedFilesRepository
{
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async findUpdatedBefore(
    cutoffDate: Date,
    limit: number,
  ): Promise<string[]> {
    const rows = await this.sequelize.query<{ file_id: string }>(
      `SELECT file_id FROM deleted_files_new
       WHERE updated_at < :cutoffDate
       ORDER BY updated_at ASC
       LIMIT :limit`,
      {
        replacements: { cutoffDate, limit },
        type: QueryTypes.SELECT,
      },
    );

    return rows.map((r) => r.file_id);
  }

  async destroyByFileIds(fileIds: string[]): Promise<number> {
    if (fileIds.length === 0) {
      return 0;
    }

    const [, meta] = await this.sequelize.query(
      'DELETE FROM deleted_files_new WHERE file_id IN (:fileIds)',
      { replacements: { fileIds } },
    );

    return (meta as unknown as { rowCount: number }).rowCount;
  }
}
