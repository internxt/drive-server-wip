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
      `SELECT * FROM folders WHERE name = :name`,
      {
        replacements: {
          name: ['NormalFolder'],
        },
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    const folder = folders[0];

    if (!users || users.length !== 2) {
      throw new Error('No users found');
    }

    const filesData = [
      {
        uuid: v4(),
        file_id: 'file1',
        name: 'File 1',
        plain_name: 'file1.txt',
        type: 'text/plain',
        size: 1024,
        bucket: 'bucket1',
        folder_id: folder.id,
        folder_uuid: folder.uuid,
        encrypt_version: '1.0',
        user_id: users[0].id,
        modification_time: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        removed: false,
        removed_at: null,
        deleted: false,
        deleted_at: null,
        status: 'EXISTS',
      },
    ];

    await queryInterface.bulkInsert('files', filesData);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(
      'files',
      {
        file_id: {
          [Op.in]: ['file1'],
        },
      },
      {},
    );
  },
};
