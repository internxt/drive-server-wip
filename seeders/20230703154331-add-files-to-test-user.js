'use strict';
const Chance = require('chance');
const chance = new Chance();

function generateFakeFolder(userId) {
  const parent_id = null;
  const name = chance.word();
  const bucket = chance.string({ length: 24 });
  const user_id = userId;
  const created_at = chance.date({ string: true });
  const updated_at = chance.date({ string: true });
  const encrypt_version = chance.string({ length: 20 });
  const deleted = chance.bool();
  const deleted_at = chance.date({ string: true });
  const uuid = chance.guid();
  const parent_uuid = null;
  const removed = false;
  const removed_at = chance.date({ string: true });

  return {
    parent_id,
    name,
    bucket,
    user_id,
    created_at,
    updated_at,
    encrypt_version,
    deleted,
    deleted_at,
    plain_name: name,
    uuid,
    parent_uuid,
    removed,
    removed_at,
  };
}

function generateFakeFile(folderId, folderUuid, userId) {
  const name = chance.word();
  const type = 'png';
  const size = chance.integer({ min: 1024, max: 10240 });
  const folder_id = folderId;
  const file_id = chance.string({ length: 24 });
  const bucket = chance.string({ length: 24 });
  const created_at = chance.date({ string: true });
  const updated_at = chance.date({ string: true });
  const encrypt_version = chance.string({ length: 20 });
  const deleted = chance.bool();
  const deleted_at = chance.date({ string: true });
  const user_id = userId;
  const modification_time = chance.date({ string: true });
  const plain_name = chance.word();
  const uuid = chance.guid();
  const folder_uuid = folderUuid;
  const removed = chance.bool();
  const removed_at = chance.date({ string: true });
  const status = 'EXISTS';

  return {
    name,
    type,
    size,
    folder_id,
    file_id,
    bucket,
    created_at,
    updated_at,
    encrypt_version,
    deleted,
    deleted_at,
    user_id,
    modification_time,
    plain_name,
    uuid,
    folder_uuid,
    removed,
    removed_at,
    status,
  };
}

// Generate an array of fake data objects
function generateFakeDataArray(count, folderId, folderUuid, userId) {
  const fakeDataArray = [];
  for (let i = 0; i < count; i++) {
    const fakeFile = generateFakeFile(folderId, folderUuid, userId);
    fakeDataArray.push(fakeFile);
  }
  return fakeDataArray;
}
module.exports = {
  async up(queryInterface) {
    const result = await queryInterface.sequelize.query(
      `SELECT id, uuid FROM users WHERE uuid = '87204d6b-c4a7-4f38-bd99-f7f47964a643'`,
    );

    const folder = generateFakeFolder(result[0][0].id);

    await queryInterface.bulkInsert('folders', [folder]);

    const { folderId, folderUuid } = await queryInterface.sequelize.query(
      'SELECT uuid, id FROM folders ORDER BY created_at DESC LIMIT 1',
    );

    const data = generateFakeDataArray(
      1000,
      folderId,
      folderUuid,
      result[0][0].id,
    );
    await queryInterface.bulkInsert('files', data);
  },

  async down(queryInterface) {
    const data = await queryInterface.sequelize.query(
      `SELECT id, uuid FROM users WHERE uuid = '87204d6b-c4a7-4f38-bd99-f7f47964a643' LIMIT 1`,
    );

    await queryInterface.sequelize.query(
      'DELETE FROM files WHERE user_id = :id',
      {
        replacements: { id: data[0][0].id },
      },
    );
    await queryInterface.sequelize.query(
      'DELETE FROM folders WHERE user_id = :id',
      {
        replacements: { id: data[0][0].id },
      },
    );
  },
};
