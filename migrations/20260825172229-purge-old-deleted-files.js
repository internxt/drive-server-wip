'use strict';

const TABLE_NAME = 'deleted_files';
const INDEX_NAME = 'deleted_files_files_to_delete_idx';
const OLD_NOT_REQUIRED_INDEX = 'deleted_files_recent_updated_at_idx';

const CUTOFF_DATE = '2026-02-25'; // 6 months from the current date.
const BATCH_SIZE = 2000;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`DROP INDEX CONCURRENTLY IF EXISTS ${OLD_NOT_REQUIRED_INDEX}`);

    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS ${INDEX_NAME}
        ON ${TABLE_NAME} (updated_at) INCLUDE (file_id)
        WHERE updated_at < '${CUTOFF_DATE}'
    `);

    let totalDeleted = 0;
    let batchCount = BATCH_SIZE;

    while (batchCount === BATCH_SIZE) {
      const [rows] = await queryInterface.sequelize.query(
        `
        DELETE FROM ${TABLE_NAME} t
        USING (
          SELECT file_id FROM ${TABLE_NAME}
          WHERE updated_at < :cutoff
          ORDER BY updated_at ASC
          LIMIT :batchSize
        ) sub
        WHERE t.file_id = sub.file_id
        RETURNING sub.file_id
        `,
        {
          replacements: {
            cutoff: CUTOFF_DATE,
            batchSize: BATCH_SIZE,
          },
        },
      );

      batchCount = rows.length;
      totalDeleted += batchCount;

      console.log(
        `[purge-old-deleted-files] batch done, total deleted: ${totalDeleted}`,
      );
    }

    console.log(
      `[purge-old-deleted-files] FINISHED. total deleted: ${totalDeleted}`,
    );

    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS ${INDEX_NAME}`,
    );
  },

  async down() {
    // No down migration, there's no records to restore
  },
};
