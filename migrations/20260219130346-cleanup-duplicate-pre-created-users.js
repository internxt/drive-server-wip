/* eslint-disable prettier/prettier */
'use strict';

const BATCH_SIZE = 1000;
const MAX_ATTEMPTS = 10;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    console.info(
      'Starting migration: cleaning up duplicate pre_created_users by username',
    );

    let attempts = 0;
    let success = false;

    while (!success && attempts < MAX_ATTEMPTS) {
      try {
        const [duplicates] = await queryInterface.sequelize.query(`
          SELECT dup.id AS dup_id, dup.uuid AS dup_uuid
          FROM pre_created_users dup
          INNER JOIN (
            SELECT username, MAX(id) AS keeper_id
            FROM pre_created_users
            GROUP BY username
            HAVING COUNT(*) > 1
          ) dups ON dups.username = dup.username AND dup.id != dups.keeper_id;
        `);

        console.info(`Found ${duplicates.length} duplicate rows to process.`);

        let totalInvitesDeleted = 0;
        for (let i = 0; i < duplicates.length; i += BATCH_SIZE) {
          const batch = duplicates.slice(i, i + BATCH_SIZE);
          const uuids = batch.map((d) => `'${d.dup_uuid}'`).join(',');

          const [deleted] = await queryInterface.sequelize.query(`
            DELETE FROM sharing_invites WHERE shared_with IN (${uuids}) RETURNING id;
          `);

          totalInvitesDeleted += deleted.length;
        }
        console.info(`Deleted ${totalInvitesDeleted} sharing_invites referencing duplicate UUIDs.`);

        let totalDeleted = 0;
        for (let i = 0; i < duplicates.length; i += BATCH_SIZE) {
          const batch = duplicates.slice(i, i + BATCH_SIZE);
          const ids = batch.map((d) => d.dup_id).join(',');

          const [deleted] = await queryInterface.sequelize.query(`
            DELETE FROM pre_created_users WHERE id IN (${ids}) RETURNING id;
          `);

          totalDeleted += deleted.length;
          console.info(`Deleted batch of ${deleted.length} duplicate rows (total: ${totalDeleted}).`);
        }

        console.info(
          `Migration completed. Deleted ${totalInvitesDeleted} sharing_invites, deleted ${totalDeleted} duplicate pre_created_users.`,
        );
        success = true;
      } catch (err) {
        attempts++;
        console.error(
          `[ERROR]: Error during cleanup (attempt ${attempts}/${MAX_ATTEMPTS}): ${err.message}`,
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

  async down() { },
};
