'use strict';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_ATTEMPTS = 10;
const BATCH_SIZE = 1000;
const SLEEP_TIME_MS = 5000;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    let updatedCount = 0;
    let attempts = 0;

    const updateQuery = `
      WITH batch AS (
        SELECT t.id, f.uuid AS file_uuid
        FROM thumbnails t
        JOIN files f ON t.file_id = f.id
        WHERE t.file_uuid IS NULL
          AND t.file_id IS NOT NULL
        LIMIT ${BATCH_SIZE}
      )
      UPDATE thumbnails
      SET file_uuid = batch.file_uuid
      FROM batch
      WHERE thumbnails.id = batch.id
      RETURNING thumbnails.id;
    `;

    console.info(
      'Starting migration: populating thumbnails with missing file_uuid',
    );

    do {
      try {
        const [results] = await queryInterface.sequelize.query(updateQuery);
        updatedCount = results.length;
        attempts = 0;

        console.info(`Updated ${updatedCount} thumbnails in this batch`);
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
        updatedCount = BATCH_SIZE;
      }
    } while (updatedCount === BATCH_SIZE);

    console.info('Migration completed: thumbnails file_uuid population');
  },

  async down(queryInterface) {
    console.info('Rolling back: setting all thumbnails file_uuid to NULL');

    await queryInterface.sequelize.query(`
      UPDATE thumbnails 
      SET file_uuid = NULL
      WHERE file_uuid IS NOT NULL
    `);

    console.info('Rollback completed: thumbnails file_uuid cleared');
  },
};
