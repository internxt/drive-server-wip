'use strict';

const { v4 } = require('uuid');
const { Op, Sequelize } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    // Primero, busca los usuarios que necesitas.
    const users = await queryInterface.sequelize.query(
      `SELECT * FROM users WHERE email IN (:emails)`,
      {
        replacements: { emails: ['john@doe.com', 'johnTwo@doe.com'] },
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    // Comprueba que se encontraron los usuarios.
    if (!users || users.length !== 2) {
      throw new Error('No se encontraron los usuarios requeridos para esta migración.');
    }

    const folderOne = {
      id: 1,
      parent_id: null,
      name: 'FolderOne',
      bucket: 'bucketOne',
      user_id: users[0].id,  // Asegúrate de que esto coincide con el usuario correcto.
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
      user_id: users[1].id, // Asegúrate de que esto coincide con el usuario correcto.
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
        id: { [Op.in]: [1, 2] },
      },
      {},
    );
  },
};
