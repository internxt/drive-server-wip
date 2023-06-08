'use strict';

const { v4 } = require('uuid');
const { Op } = require('sequelize');

const folderOne = {
  id: 1,
  parent_id: null,
  name: 'FolderOne',
  bucket: 'bucketOne',
  user_id: '20',
  uuid: v4(),
  plain_name: 'FolderOne',
  encrypt_version: '1.0',
  deleted: false,
  removed: false,
  created_at: new Date(),
  updated_at: new Date(),
};

const folderTwo = {
  id: 2,
  parent_id: null,
  name: 'FolderTwo',
  bucket: 'bucketTwo',
  user_id: '21',
  uuid: v4(),
  plain_name: 'FolderTwo',
  encrypt_version: '1.0',
  deleted: false,
  removed: false,
  created_at: new Date(),
  updated_at: new Date(),
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('folders', [folderOne, folderTwo]);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      'folders',
      {
        id: { [Op.in]: [folderOne.id, folderTwo.id] },
      },
      {},
    );
  },
};
