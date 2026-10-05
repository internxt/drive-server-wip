'use strict';

const tableName = 'pre_created_users';
const statusEnumName = 'enum_pre_created_users_status';
const statusValues = ['awaiting_payment', 'pending_setup', 'cancelled'];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        tableName,
        'setup_email_sent_at',
        {
          type: Sequelize.DATE,
          allowNull: true,
        },
        { transaction },
      );

      await queryInterface.addColumn(
        tableName,
        'tier_id',
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'tiers', key: 'id' },
        },
        { transaction },
      );

      await queryInterface.addColumn(
        tableName,
        'status',
        {
          type: Sequelize.ENUM(...statusValues),
          allowNull: true,
        },
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn(tableName, 'status', { transaction });
      await queryInterface.removeColumn(tableName, 'tier_id', { transaction });
      await queryInterface.removeColumn(tableName, 'setup_email_sent_at', {
        transaction,
      });

      await queryInterface.sequelize.query(
        `DROP TYPE IF EXISTS "${statusEnumName}";`,
        { transaction },
      );
    });
  },
};
