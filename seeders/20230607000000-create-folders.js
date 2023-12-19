'use strict';

const { v4 } = require('uuid');
const { Op, Sequelize } = require('sequelize');

const foldersNames = [
  'FolderOne',
  'FolderTwo',
  'FolderFather',
  'RemovedFolder',
  'DeletedFolder',
  'NormalFolder',
];

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
        replacements: { names: foldersNames },
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    if (existingFolders.length === foldersNames.length) {
      console.log(
        `Folders with the names ${foldersNames.join(
          ',',
        )} already exist. Skipping creation.`,
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

    const folderFather = createFolderObject(
      'FolderFather',
      'bucketFather',
      users[0].id,
      null,
    );

    await queryInterface.bulkInsert('folders', [folderFather]);

    const fatherFolderSaved = await queryInterface.sequelize.query(
      `SELECT * FROM folders WHERE uuid = :uuid`,
      {
        replacements: { uuid: folderFather.uuid },
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    const deletedFolder = createDeletedFolderObject(
      'DeletedFolder',
      'bucketThree',
      users[0].id,
      fatherFolderSaved[0].id,
      fatherFolderSaved[0].uuid,
    );

    const removedFolder = createRemovedFolderObject(
      'RemovedFolder',
      'bucketFour',
      users[0].id,
      fatherFolderSaved[0].id,
      fatherFolderSaved[0].uuid,
    );

    const normalFolder = createFolderObject(
      'NormalFolder',
      'bucketFive',
      users[0].id,
      fatherFolderSaved[0].id,
      fatherFolderSaved[0].uuid,
    );

    await queryInterface.bulkInsert('folders', [
      folderOne,
      folderTwo,
      removedFolder,
      deletedFolder,
      normalFolder,
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(
      'folders',
      {
        uuid: { [Op.in]: foldersNames },
      },
      {},
    );
  },
};

function createFolderObject(name, bucket, userId, parentId, parentUUID) {
  return {
    parent_id: parentId || null,
    parent_uuid: parentUUID || null,
    name,
    bucket,
    user_id: userId,
    uuid: v4(),
    plain_name: name,
    encrypt_version: '1.0',
    deleted: false,
    removed: false,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

function createDeletedFolderObject(name, bucket, userId, parentId, parentUUID) {
  return {
    parent_id: parentId,
    parent_uuid: parentUUID,
    name,
    bucket,
    user_id: userId,
    uuid: v4(),
    plain_name: name,
    encrypt_version: '1.0',
    deleted: true,
    removed: false,
    deleted_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };
}

function createRemovedFolderObject(name, bucket, userId, parentId, parentUUID) {
  return {
    parent_id: parentId,
    parent_uuid: parentUUID,
    name,
    bucket,
    user_id: userId,
    uuid: v4(),
    plain_name: name,
    encrypt_version: '1.0',
    deleted: false,
    removed: true,
    removed_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };
}
