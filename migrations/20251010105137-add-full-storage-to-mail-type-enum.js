'use strict';

const newMailType = 'full_storage';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `ALTER TYPE mail_type ADD VALUE '${newMailType}';`,
    );
  },
  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `
        ALTER TYPE mail_type RENAME TO mail_type_old;
        CREATE TYPE mail_type AS ENUM('invite_friend', 'reset_password', 'remove_account', 'email_verification', 'deactivate_user', 'unblock_account', 'pre_create_user', 'incomplete_checkout');
        ALTER TABLE mail_limits ALTER COLUMN mail_type TYPE mail_type USING mail_type::text::mail_type;
        DROP TYPE mail_type_old;
      `,
    );
  },
};
