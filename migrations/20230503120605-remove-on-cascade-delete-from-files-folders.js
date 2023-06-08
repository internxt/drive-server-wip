'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // avoid locks using NOT VALID and then validating the constraint after
    await queryInterface.sequelize.query(`
      ALTER TABLE files
      ADD CONSTRAINT files_folder_id_fkey
      FOREIGN KEY (folder_id)
      REFERENCES folders (id)
      ON DELETE SET NULL
      NOT VALID
    `);
    await queryInterface.sequelize.query(`ALTER TABLE files VALIDATE CONSTRAINT files_folder_id_fkey;`);

    await queryInterface.removeConstraint('files', 'files_folder_uuid_fkey');
    await queryInterface.sequelize.query(`
      ALTER TABLE files
      ADD CONSTRAINT files_folder_uuid_fkey
      FOREIGN KEY (folder_uuid)
      REFERENCES folders (uuid)
      ON DELETE SET NULL
      NOT VALID
    `);
    await queryInterface.sequelize.query(`ALTER TABLE files VALIDATE CONSTRAINT files_folder_uuid_fkey;`);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeConstraint('files', 'files_folder_id_fkey');
    await queryInterface.addConstraint('files', {
      fields: ['folder_id'],
      type: 'foreign key',
      name: 'files_folder_id_fkey',
      references: {
        table: 'folders',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
    await queryInterface.removeConstraint('files', 'files_folder_uuid_fkey');
    await queryInterface.addConstraint('files', {
      fields: ['folder_uuid'],
      type: 'foreign key',
      name: 'files_folder_uuid_fkey',
      references: {
        table: 'folders',
        field: 'uuid',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  },
};
