'use strict';

const indexTypeUser = 'idx_mail_limits_type_user';
const indexUserType = 'idx_mail_limits_user_type';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `CREATE INDEX IF NOT EXISTS ${indexTypeUser} ON mail_limits (mail_type, user_id)`,
    );
    await queryInterface.sequelize.query(
      `CREATE INDEX IF NOT EXISTS ${indexUserType} ON mail_limits (user_id, mail_type)`,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${indexTypeUser}`);
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${indexUserType}`);
  },
};
