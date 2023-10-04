'use strict';

const tableName = 'sharing_roles';
const fkName = 'sharing_roles_sharing_id_fkey';

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeConstraint(tableName, fkName, { transaction });
      await queryInterface.addConstraint(tableName, {
        fields: ['sharing_id'],
        type: 'foreign key',
        name: fkName,
        references: {
          table: 'sharings',
          field: 'id',
        },
        onDelete: 'CASCADE',
        transaction,
      });
      return transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeConstraint(tableName, fkName, { transaction });
      await queryInterface.addConstraint(tableName, {
        fields: ['sharing_id'],
        type: 'foreign key',
        name: fkName,
        references: {
          table: 'sharings',
          field: 'id',
        },
        transaction,
      });
      return transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
