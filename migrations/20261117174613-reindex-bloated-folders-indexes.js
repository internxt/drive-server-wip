'use strict';

const indexes = [
  'idx_folders_user_id_updated_at_parent_uuid_not_null',
  'folders_parentuuid_plainname_numeric_unique',
  'folders_parent_uuid_index',
  'folders_pkey',
  'idx_folders_user_parent_numname',
  'idx_folders_trashed_user_updated_at',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Sequential to keep WAL peak and replica lag bounded to one index at a time
  async up(queryInterface) {
    for (const index of indexes) {
      await queryInterface.sequelize.query(
        `REINDEX INDEX CONCURRENTLY public.${index}`,
      );
    }
  },

  async down() {},
};
