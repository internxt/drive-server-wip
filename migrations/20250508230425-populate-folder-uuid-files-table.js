'use strict';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_ATTEMPTS = 10;
const BATCH_SIZE = 1000;
const SLEEP_TIME_MS = 5000;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    let updatedCount = 0;
    let attempts = 0;

    const updateQuery = `
      WITH batch AS (
        SELECT f.id, folders.uuid AS folder_uuid
        FROM files f
        JOIN folders ON f.folder_id = folders.id
        WHERE f.folder_uuid IS NULL
          AND f.folder_id IS NOT NULL
          AND f.status != 'DELETED'
        LIMIT ${BATCH_SIZE}
      )
      UPDATE files
      SET folder_uuid = batch.folder_uuid
      FROM batch
      WHERE files.id = batch.id
      RETURNING files.id;
    `;

    console.info(
      'Starting migration: populating files with missing folder_uuid',
    );

    do {
      try {
        const [results] = await queryInterface.sequelize.query(updateQuery);
        updatedCount = results.length;
        attempts = 0;

        console.info(`Updated ${updatedCount} files in this batch`);
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
  },

  async down(queryInterface, Sequelize) {},
};
