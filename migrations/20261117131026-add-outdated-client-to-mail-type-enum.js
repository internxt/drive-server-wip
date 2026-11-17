'use strict';

const newMailType = 'outdated_client';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TYPE mail_type ADD VALUE IF NOT EXISTS '${newMailType}'`,
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM mail_limits WHERE mail_type = '${newMailType}';
      ALTER TYPE mail_type RENAME TO mail_type_old;
      CREATE TYPE mail_type AS ENUM(
        'invite_friend',
        'reset_password',
        'remove_account',
        'email_verification',
        'deactivate_user',
        'unblock_account',
        'pre_create_user',
        'incomplete_checkout',
        'full_storage',
        'inactive_users'
      );
      ALTER TABLE mail_limits ALTER COLUMN mail_type TYPE mail_type USING mail_type::text::mail_type;
      DROP TYPE mail_type_old;
    `);
  },
};
