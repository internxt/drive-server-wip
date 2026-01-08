'use strict';

const MAX_ATTEMPTS = 10;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, _Sequelize) {
    console.info(
      'Starting migration: cleaning up devices with deleted folders',
    );

    let attempts = 0;
    let success = false;

    while (!success && attempts < MAX_ATTEMPTS) {
      try {
        const [results] = await queryInterface.sequelize.query(`
          DELETE FROM devices
          WHERE id IN (
            SELECT d.id
            FROM devices d
            INNER JOIN folders f ON d.folder_uuid = f.uuid
            WHERE f.deleted = true
          )
          RETURNING id;
        `);

        console.info(
          `Migration completed. Deleted ${results.length} orphaned devices.`,
        );
        success = true;
      } catch (err) {
        attempts++;
        console.error(
          `[ERROR]: Error during deletion (attempt ${attempts}/${MAX_ATTEMPTS}): ${err.message}`,
        );

        if (attempts >= MAX_ATTEMPTS) {
          console.error(
            '[ERROR]: Maximum retry attempts reached, exiting migration.',
          );
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  },

  async down() {},
};
