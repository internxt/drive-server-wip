'use strict';

// UUID as PK: Step 1 - 2: Validate constraint
// This migration is in another file in case of a failure
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Schema updates / vacuums will be locked until the constraint is validated.
    await queryInterface.sequelize.query(`
      ALTER TABLE files VALIDATE CONSTRAINT uuid_not_null_chk;
      `);
  },

  async down(queryInterface, Sequelize) {
    // You cannot un-validate a constraint.
  }
};
