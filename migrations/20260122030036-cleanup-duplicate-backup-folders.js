'use strict';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_ATTEMPTS = 10;
const BATCH_SIZE = 100;
const SLEEP_TIME_MS = 5000;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    let totalDeleted = 0;
    let batchCount = 0;
    let attempts = 0;

    console.info(`Batch size: ${BATCH_SIZE} duplicate groups per batch`);

    console.info('Starting cleanup of duplicate backup folders...');

    const deleteQuery = `
      WITH duplicate_groups AS (
        SELECT
          plain_name,
          bucket,
          user_id,
          MIN(id) as id_to_keep
        FROM folders
        WHERE
          created_at >= '2025-12-17 14:16:00'
          AND created_at <= '2026-01-05 21:50:00'
          AND parent_id IS NULL
          AND parent_uuid IS NULL
          AND deleted = false
          AND removed = false
          AND plain_name IS NOT NULL
        GROUP BY plain_name, bucket, user_id
        HAVING COUNT(*) > 1
        LIMIT ${BATCH_SIZE}
      ),
      folders_to_delete AS (
        SELECT f.id
        FROM folders f
        INNER JOIN duplicate_groups dg
          ON f.plain_name = dg.plain_name
          AND f.bucket = dg.bucket
          AND f.user_id = dg.user_id
        WHERE
          f.id != dg.id_to_keep
          AND NOT EXISTS (
            SELECT 1
            FROM files
            WHERE folder_id = f.id
            AND status != 'DELETED'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM folders child
            WHERE child.parent_uuid = f.uuid
            AND child.deleted = false
          )
      )
      UPDATE folders
      SET
        deleted = true,
        deleted_at = NOW(),
        removed = true,
        removed_at = NOW()
      FROM folders_to_delete
      WHERE folders.id = folders_to_delete.id
        AND folders.deleted = false
        AND folders.removed = false
      RETURNING folders.id;
    `;

    let hasMore = true;

    while (hasMore) {
      try {
        const [results] = await queryInterface.sequelize.query(deleteQuery);
        const deletedInBatch = results.length;
        batchCount++;
        totalDeleted += deletedInBatch;
        attempts = 0;

        console.info(
          `Batch ${batchCount}: Deleted ${deletedInBatch} folders (Total: ${totalDeleted})`,
        );

        hasMore = deletedInBatch > 0;

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
          break;
        }

        await sleep(SLEEP_TIME_MS);
      }
    }

    console.info('\n=== Cleanup Complete ===');
    console.info(`Total batches processed: ${batchCount}`);
    console.info(`Total folders deleted: ${totalDeleted}`);
  },
  async down() {},
};
