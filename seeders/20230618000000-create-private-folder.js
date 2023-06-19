'use strict';

const { v4 } = require('uuid');
const { Op, Sequelize } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    const users = await queryInterface.sequelize.query(
      `SELECT * FROM users WHERE email IN (:emails)`,
      {
        replacements: { emails: ['john@doe.com', 'johnTwo@doe.com'] },
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    const folders = await queryInterface.sequelize.query(
      `SELECT * FROM folders WHERE name IN (:names)`,
      {
        replacements: { names: ['FolderOne', 'FolderTwo'] },
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    if (!users || users.length !== 2 || !folders || folders.length !== 2) {
      throw new Error('No user found.');
    }

    const sharingFolderOne = {
      id: v4(),
      folder_id: folders[0].id,
      folder_uuid: folders[0].uuid,
      owner_id: users[0].id,
      owner_uuid: v4(), //users[0].uuid,
      shared_with_id: users[1].id,
      shared_with_uuid: v4(), //users[1].uuid,
      encrypted_key: 'clave cifrada',
      created_at: new Date(),
      updated_at: new Date(),
    };

    const sharingFolderTwo = {
      id: v4(),
      folder_id: folders[1].id,
      folder_uuid: folders[1].uuid,
      owner_id: users[1].id,
      owner_uuid: v4(),
      shared_with_id: users[0].id,
      shared_with_uuid: v4(),
      encrypted_key: 'clave cifrada',
      created_at: new Date(),
      updated_at: new Date(),
    };

    await queryInterface.bulkInsert('private_sharing_folder', [
      sharingFolderOne,
      sharingFolderTwo,
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      'private_sharing_folder',
      {
        id: { [Op.in]: [1, 2] },
      },
      {},
    );
  },
};
