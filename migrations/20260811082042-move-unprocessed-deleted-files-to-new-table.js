'use strict';

const SOURCE_TABLE = 'deleted_files';
const TARGET_TABLE = 'deleted_files_new';
const BATCH_SIZE = 1000;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    let totalMoved = 0;
    let batchCount = BATCH_SIZE;

    while (batchCount === BATCH_SIZE) {
      const [rows] = await queryInterface.sequelize.query(
        `
        SELECT file_id, network_file_id, created_at, updated_at
        FROM ${SOURCE_TABLE}
        WHERE processed = false
        ORDER BY file_id
        LIMIT :batchSize
        `,
        { replacements: { batchSize: BATCH_SIZE } },
      );

      batchCount = rows.length;

      if (batchCount === 0) {
        break;
      }

      await queryInterface.bulkInsert(
        TARGET_TABLE,
        rows.map((row) => ({
          file_id: row.file_id,
          network_file_id: row.network_file_id,
          processed: false,
          created_at: row.created_at,
          updated_at: row.updated_at,
          processed_at: null,
          enqueued: false,
          enqueued_at: null,
        })),
        { ignoreDuplicates: true },
      );

      const ids = rows.map((row) => row.file_id);

      await queryInterface.sequelize.query(
        `DELETE FROM ${SOURCE_TABLE} WHERE file_id IN (:ids)`,
        { replacements: { ids } },
      );

      totalMoved += batchCount;

      console.log(
        `[move-unprocessed-deleted-files] batch done, total moved: ${totalMoved}`,
      );
    }

    console.log(
      `[move-unprocessed-deleted-files] FINISHED. total moved: ${totalMoved}`,
    );
  },

  async down() {
    // No down migration, moved rows already re-enqueue via processed/enqueued flags in target table
  },
};
