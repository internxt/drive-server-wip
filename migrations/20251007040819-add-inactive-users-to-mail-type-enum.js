'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TYPE mail_type ADD VALUE IF NOT EXISTS 'inactive_users'
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TYPE mail_type RENAME TO mail_type_old;
      CREATE TYPE mail_type AS ENUM(
        'invite_friend',
        'reset_password',
        'remove_account',
        'email_verification',
        'deactivate_user',
        'unblock_account',
        'pre_create_user',
        'incomplete_checkout'
      );
      ALTER TABLE mail_limits ALTER COLUMN mail_type TYPE mail_type USING mail_type::text::mail_type;
      DROP TYPE mail_type_old;
    `);
  }
};
