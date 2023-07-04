'use strict';

const { v4 } = require('uuid');
const { Op } = require('sequelize');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Obtén los usuarios desde la base de datos
    const users = await queryInterface.sequelize.query(
      'SELECT * FROM users WHERE email IN (:emails)',
      {
        replacements: { emails: ['john@doe.com', 'johnTwo@doe.com'] },
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    const shareOne = {
      id: 1,
      folder_id: 1,
      user_id: users[0].id,
      bucket: 'bucketOne',
      file_token: v4(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    const existingShare = await queryInterface.sequelize.query(
      'SELECT * FROM shares WHERE id = :id',
      {
        replacements: { id: shareOne.id },
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    if (existingShare.length === 0) {
      await queryInterface.bulkInsert('shares', [shareOne]);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('shares', null, {});
  },
};
