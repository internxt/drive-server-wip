'use strict';

const tableName = 'devices';
const keyColumn = 'key';
const folderUuidColumn = 'folder_uuid';
const macColumn = 'mac';
const uniqueConstraintName = 'devices_key_user_platform_unique';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, keyColumn, {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn(tableName, folderUuidColumn, {
      type: Sequelize.UUID,
      allowNull: true,
    });
    await queryInterface.changeColumn(tableName, macColumn, {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addConstraint(tableName, {
      fields: [keyColumn, 'userId', 'platform'],
      type: 'unique',
      name: uniqueConstraintName,
      where: {
        [keyColumn]: {
          [Sequelize.Op.ne]: null,
        },
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint(tableName, uniqueConstraintName);
    await queryInterface.removeColumn(tableName, folderUuidColumn);
    await queryInterface.removeColumn(tableName, keyColumn);

    await queryInterface.changeColumn(tableName, macColumn, {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
