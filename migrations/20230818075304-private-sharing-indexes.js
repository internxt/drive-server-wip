'use strict';

const sharedWithIndexName = 'private_sharing_folder_shared_with_index';
const ownerIdIndexName = 'private_sharing_folder_owner_id_index';
const folderIdIndexName = 'private_sharing_folder_folder_id_index';
const folderIdRolesIndexName = 'private_sharing_folder_roles_folder_id_index';
const userIdRolesIndexName = 'private_sharing_folder_roles_user_id_index';

module.exports = {
  async up(queryInterface) {
    /**
     * private_sharing_folder indexes
     */
    await queryInterface.addIndex('private_sharing_folder', {
      fields: ['shared_with'],
      name: sharedWithIndexName,
    });

    await queryInterface.addIndex('private_sharing_folder', {
      fields: ['owner_id'],
      name: ownerIdIndexName,
    });

    await queryInterface.addIndex('private_sharing_folder', {
      fields: ['folder_id'],
      name: folderIdIndexName,
    });

    /**
     * private_sharing_folder_roles indexes
     */
    await queryInterface.addIndex('private_sharing_folder_roles', {
      fields: ['folder_id'],
      name: folderIdRolesIndexName,
    });

    await queryInterface.addIndex('private_sharing_folder_roles', {
      fields: ['user_id'],
      name: userIdRolesIndexName,
    });
  },

  async down(queryInterface) {
    /**
     * private_sharing_folder indexes
     */
    await queryInterface.removeIndex(
      'private_sharing_folder',
      sharedWithIndexName,
    );
    await queryInterface.removeIndex(
      'private_sharing_folder',
      ownerIdIndexName,
    );
    await queryInterface.removeIndex(
      'private_sharing_folder',
      folderIdIndexName,
    );

    /**
     * private_sharing_folder_roles indexes
     */
    await queryInterface.removeIndex(
      'private_sharing_folder_roles',
      folderIdRolesIndexName,
    );
    await queryInterface.removeIndex(
      'private_sharing_folder_roles',
      userIdRolesIndexName,
    );
  },
};
