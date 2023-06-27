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

    if (!users || users.length !== 2) {
      throw new Error('No users found');
    }

    const existingFolders = await queryInterface.sequelize.query(
      `SELECT * FROM folders WHERE name IN (:names)`,
      {
        replacements: { names: ['FolderOne', 'FolderTwo'] },
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    if (existingFolders.length > 0) {
      console.log(
        'Folders with the names "FolderOne" and/or "FolderTwo" already exist. Skipping creation.',
      );
      return;
    }

    const folderOne = {
      parent_id: null,
      name: 'FolderOne',
      bucket: 'bucketOne',
      user_id: users[0].id,
      uuid: v4(),
      plain_name: 'FolderOne',
      encrypt_version: '1.0',
      deleted: false,
      removed: false,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const folderTwo = {
      parent_id: null,
      name: 'FolderTwo',
      bucket: 'bucketTwo',
      user_id: users[1].id,
      uuid: v4(),
      plain_name: 'FolderTwo',
      encrypt_version: '1.0',
      deleted: false,
      removed: false,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await queryInterface.bulkInsert('folders', [folderOne, folderTwo]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      'folders',
      {
        uuid: { [Op.in]: [folderOne.uuid, folderTwo.uuid] },
      },
      {},
    );
  },
};