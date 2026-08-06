'use strict';

// UUID as PK: Step 1 - 1: Create not valid constraint to avoid scan and lock
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // New/Updated rows will be checked against the constraint, but existing rows will not be checked until the constraint is validated.
    // This allows adding the constraint without locking the table (otherwhise a big scan is required)
    await queryInterface.sequelize.query(`
      SET lock_timeout = '2s';
      ALTER TABLE files ADD CONSTRAINT uuid_not_null_chk CHECK (uuid IS NOT NULL) NOT VALID;
      RESET lock_timeout;
      `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
        SET lock_timeout = '2s';
        ALTER TABLE files DROP CONSTRAINT uuid_not_null_chk;
        RESET lock_timeout;
    `);
  }
};
