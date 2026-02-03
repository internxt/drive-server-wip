'use strict';

const BATCH_SIZE = 1000;
const MAX_ATTEMPTS = 10;
const SLEEP_TIME_MS = 5000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    console.info(
      'Starting migration: setting file_id to NULL for zero-size files',
    );

    let updatedCount = 0;
    let totalUpdated = 0;
    let attempts = 0;

    const updateQuery = `
      WITH batch AS (
        SELECT id
        FROM files
        WHERE size = 0 AND file_id IS NOT NULL AND status != 'DELETED'
        LIMIT ${BATCH_SIZE}
      )
      UPDATE files
      SET file_id = NULL, updated_at = NOW()
      FROM batch
      WHERE files.id = batch.id
      RETURNING files.id;
    `;

    do {
      try {
        const [results] = await queryInterface.sequelize.query(updateQuery);
        updatedCount = results.length;
        totalUpdated += updatedCount;
        attempts = 0;

        console.info(
          `Updated ${updatedCount} files in this batch (total: ${totalUpdated})`,
        );
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

        await sleep(SLEEP_TIME_MS);
        updatedCount = BATCH_SIZE;
      }
    } while (updatedCount === BATCH_SIZE);

    console.info(`Migration completed. Total files updated: ${totalUpdated}`);
  },

  async down() {},
};
