'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE job_executions ALTER COLUMN status DROP DEFAULT;
       ALTER TABLE job_executions ALTER COLUMN status TYPE text USING status::text;
       DROP TYPE enum_job_executions_status;
       ALTER TABLE job_executions ALTER COLUMN status SET DEFAULT 'running';
      `,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `CREATE TYPE enum_job_executions_status AS ENUM('running', 'completed', 'failed', 'aborted');
       ALTER TABLE job_executions ALTER COLUMN status TYPE enum_job_executions_status USING status::enum_job_executions_status;
       ALTER TABLE job_executions ALTER COLUMN status SET DEFAULT 'running'::enum_job_executions_status;
       `,
    );
  },
};
