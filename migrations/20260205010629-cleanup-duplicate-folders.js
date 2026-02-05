'use strict';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_ATTEMPTS = 10;
const BATCH_SIZE = 500;
const SLEEP_TIME_MS = 1000;

module.exports = {
  up: async (queryInterface) => {
    let totalRenamed = 0;
    let batchCount = 0;
    let attempts = 0;

    console.info(`Batch size: ${BATCH_SIZE} duplicate folders per batch`);
    console.info('Starting cleanup of duplicate folders...');

    const renameQuery = `
      WITH duplicate_groups AS (
        SELECT parent_uuid, plain_name, MIN(id) as id_to_keep
        FROM folders
        WHERE deleted = false
          AND removed = false
          AND parent_uuid IS NOT NULL
          AND plain_name IS NOT NULL
        GROUP BY parent_uuid, plain_name
        HAVING COUNT(*) > 1
        LIMIT ${BATCH_SIZE}
      )
      UPDATE folders f
      SET
        plain_name = f.plain_name || '_' || f.id::text,
        updated_at = NOW()
      FROM duplicate_groups dg
      WHERE f.parent_uuid = dg.parent_uuid
        AND f.plain_name = dg.plain_name
        AND f.id != dg.id_to_keep
        AND f.deleted = false
        AND f.removed = false
      RETURNING f.id;
    `;

    let hasMore = true;

    while (hasMore) {
      try {
        const [results] = await queryInterface.sequelize.query(renameQuery);
        const renamedInBatch = results.length;
        batchCount++;
        totalRenamed += renamedInBatch;
        attempts = 0;

        console.info(
          `Batch ${batchCount}: Renamed ${renamedInBatch} folders (Total: ${totalRenamed})`,
        );

        hasMore = renamedInBatch > 0;

        if (hasMore) {
          await sleep(SLEEP_TIME_MS);
        }
      } catch (err) {
        attempts++;
        console.error(
          `[ERROR]: Error in batch ${batchCount} (attempt ${attempts}/${MAX_ATTEMPTS}): ${err.message}`,
        );

        if (attempts >= MAX_ATTEMPTS) {
          console.error(
            '[ERROR]: Maximum retry attempts reached, exiting migration.',
          );
          throw err;
        }

        await sleep(SLEEP_TIME_MS);
      }
    }

    console.info('\n=== Cleanup Complete ===');
    console.info(`Total batches processed: ${batchCount}`);
    console.info(`Total folders renamed: ${totalRenamed}`);
  },

  down: async () => {},
};
