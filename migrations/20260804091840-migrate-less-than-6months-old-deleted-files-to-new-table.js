'use strict';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_ATTEMPTS = 10;
const BATCH_SIZE = 1000;
const SLEEP_TIME_MS = 5000;

// Fixed cutoff: 6 months before this migration.
const CUTOFF_DATE = '2026-02-03';

const indexName = 'deleted_files_recent_updated_at_idx';

const selectBatchQuery = `
    SELECT file_id, network_file_id, processed, created_at, updated_at, processed_at, enqueued, enqueued_at
    FROM deleted_files
    WHERE updated_at >= '${CUTOFF_DATE}'
      AND (updated_at, file_id) > (:cursorUpdatedAt, :cursorFileId)
    ORDER BY updated_at, file_id
    LIMIT ${BATCH_SIZE};
`;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Estimation of ~ 6GB for 300M rows
    await queryInterface.sequelize.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName}
        ON deleted_files (updated_at, file_id)
        WHERE updated_at >= '${CUTOFF_DATE}';
    `);

    let cursorUpdatedAt = CUTOFF_DATE;
    let cursorFileId = '00000000-0000-0000-0000-000000000000';
    let batchLength = 0;
    let attempts = 0;
    let totalMigrated = 0;

    console.info(
      `Starting migration: deleted_files -> deleted_files_new (updated_at >= ${CUTOFF_DATE})`,
    );

    do {
      try {
        const [batch] = await queryInterface.sequelize.query(
          selectBatchQuery,
          { replacements: { cursorUpdatedAt, cursorFileId } },
        );
        batchLength = batch.length;

        if (batchLength > 0) {
          const fileIds = batch.map((row) => row.file_id);

          await queryInterface.bulkInsert('deleted_files_new', batch, {
            ignoreDuplicates: true,
          });

          await queryInterface.sequelize.query(
            `DELETE FROM deleted_files WHERE file_id IN (:fileIds);`,
            { replacements: { fileIds } },
          );

          const lastRow = batch[batchLength - 1];
          cursorUpdatedAt = lastRow.updated_at;
          cursorFileId = lastRow.file_id;
          totalMigrated += batchLength;

          console.info(
            `Migrated batch of ${batchLength} rows (total: ${totalMigrated}), cursor at (${cursorUpdatedAt}, ${cursorFileId})`,
          );
        }

        attempts = 0;
      } catch (err) {
        attempts++;
        console.error(
          `[ERROR]: Error in batch (attempt ${attempts}/${MAX_ATTEMPTS}): ${err.message}`,
        );

        if (attempts >= MAX_ATTEMPTS) {
          console.error(
            '[ERROR]: Maximum retry attempts reached, exiting migration.',
          );
          break;
        }
        // In case of database disconnection, we wait and force next loop
        await sleep(SLEEP_TIME_MS);
        batchLength = BATCH_SIZE;
      }
    } while (batchLength === BATCH_SIZE);

    console.info(
      `Migration completed: deleted_files -> deleted_files_new (${totalMigrated} rows migrated)`,
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS ${indexName};
    `);
  },
};
