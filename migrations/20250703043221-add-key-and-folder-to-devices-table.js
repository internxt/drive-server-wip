'use strict';

const tableName = 'devices';
const keyColumn = 'key';
const folderUuidColumn = 'folder_uuid';
const hostnameColumn = 'hostname';
const macColumn = 'mac';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(tableName, keyColumn, {
      type: Sequelize.STRING,
      defaultValue: 'UNKNOWN_KEY',
    });

    await queryInterface.addColumn(tableName, hostnameColumn, {
      type: Sequelize.STRING,
      defaultValue: 'UNKNOWN_HOSTNAME',
    });

    await queryInterface.addColumn(tableName, folderUuidColumn, {
      type: Sequelize.UUID,
      defaultValue: '00000000-0000-0000-0000-000000000000',
    });

    await queryInterface.changeColumn(tableName, macColumn, {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn(tableName, folderUuidColumn);
    await queryInterface.removeColumn(tableName, keyColumn);
    await queryInterface.removeColumn(tableName, hostnameColumn);

    await queryInterface.changeColumn(tableName, macColumn, {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
