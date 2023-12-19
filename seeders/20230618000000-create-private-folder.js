'use strict';

const { v4 } = require('uuid');
const { Op, Sequelize } = require('sequelize');

const uuid = 'd290f1ee-6c54-4b01-90e6-d701748f0851';
const uuid2 = 'd290f1ee-6c54-4b01-90e6-d701748f0852';

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

    if (!users || users.length < 2 || !folders || folders.length < 2) {
      throw new Error('Required users or folders not found.');
    }

    const folderOne = folders.find((f) => f.name === 'FolderOne');
    const folderTwo = folders.find((f) => f.name === 'FolderTwo');

    const sharingFolderOne = {
      id: uuid,
      folder_id: folderOne.uuid,
      owner_id: users[0].uuid,
      shared_with: users[1].uuid,
      encryption_key: 'clave cifrada',
      created_at: new Date(),
      updated_at: new Date(),
    };

    const sharingFolderTwo = {
      id: uuid2,
      folder_id: folderTwo.uuid,
      owner_id: users[1].uuid,
      shared_with: users[0].uuid,
      encryption_key: 'clave cifrada',
      created_at: new Date(),
      updated_at: new Date(),
    };

    await queryInterface.bulkInsert('private_sharing_folder', [
      sharingFolderOne,
      sharingFolderTwo,
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(
      'private_sharing_folder',
      {
        id: { [Op.in]: [sharingFolderOneId, sharingFolderTwoId] },
      },
      {},
    );
  },
};
