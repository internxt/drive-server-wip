'use strict';

// UUID as PK: Step 1 - 3: Set not null constraint and drop check
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('ALTER TABLE files ALTER COLUMN uuid SET NOT NULL;');
    // Not useful anymore since the column is now NOT NULL
    await queryInterface.sequelize.query('ALTER TABLE files DROP CONSTRAINT uuid_not_null_chk;');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('ALTER TABLE files ADD CONSTRAINT uuid_not_null_chk CHECK (uuid IS NOT NULL) NOT VALID;');
    await queryInterface.sequelize.query('ALTER TABLE files ALTER COLUMN uuid DROP NOT NULL;');
  }
};
