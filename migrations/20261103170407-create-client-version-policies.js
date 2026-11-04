'use strict';

const tableName = 'client_version_policies';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      client: {
        comment: 'Client identifier',
        type: Sequelize.STRING,
        allowNull: false,
      },
      version: {
        comment:
          'Normally NULL. An exact version replaces the general policy for that version only',
        type: Sequelize.STRING,
        allowNull: true,
      },
      min_version: {
        comment: 'Versions below this one are unsupported',
        type: Sequelize.STRING,
        allowNull: true,
      },
      deprecated_below: {
        comment: 'Versions below this one are deprecated',
        type: Sequelize.STRING,
        allowNull: true,
      },
      sunset_at: {
        comment:
          'Announced date from which deprecated versions will stop being supported.',
        type: Sequelize.DATE,
        allowNull: true,
      },
      recommended_version: {
        comment:
          'Versions below this one are recommended to update. Suggested update target',
        type: Sequelize.STRING,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX ${tableName}_client_general_key
      ON ${tableName} (client)
      WHERE version IS NULL
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX ${tableName}_client_version_key
      ON ${tableName} (client, version)
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE ${tableName}
      ADD CONSTRAINT ${tableName}_sunset_at_requires_deprecated_below
      CHECK (sunset_at IS NULL OR deprecated_below IS NOT NULL)
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable(tableName);
  },
};
