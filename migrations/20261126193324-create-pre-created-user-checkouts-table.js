'use strict';

const tableName = 'pre_created_user_checkouts';
const statusEnumName = 'enum_pre_created_user_checkouts_status';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(tableName, {
      network_uuid: {
        comment: 'Network user uuid, also the uuid of the account once set up',
        type: Sequelize.UUID,
        primaryKey: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      status: {
        type: Sequelize.ENUM('awaiting_payment', 'pending_setup', 'cancelled'),
        allowNull: false,
      },
      tier_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'tiers', key: 'id' },
      },
      setup_email_sent_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      setup_email_resend_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable(tableName, { transaction });
      await queryInterface.sequelize.query(
        `DROP TYPE IF EXISTS "${statusEnumName}";`,
        { transaction },
      );
    });
  },
};
