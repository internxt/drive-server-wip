'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const convertGbToBytes = (gbValue) => gbValue * 1024 * 1024 * 1024;

    const maxFileUploadSizeLimits = await queryInterface.sequelize.query(
      "SELECT id, value FROM limits WHERE label = 'max-file-upload-size'",
      { type: Sequelize.QueryTypes.SELECT },
    );

    for (const limit of maxFileUploadSizeLimits) {
      const bytesValue = convertGbToBytes(parseInt(limit.value)).toString();

      await queryInterface.sequelize.query(
        'UPDATE limits SET value = :bytesValue WHERE id = :id',
        {
          replacements: { bytesValue, id: limit.id },
          type: Sequelize.QueryTypes.UPDATE,
        },
      );
    }
  },

  async down(queryInterface, Sequelize) {
    const convertBytesToGB = (gbValue) => gbValue / 1024 / 1024 / 1024;

    const maxFileUploadSizeLimits = await queryInterface.sequelize.query(
      "SELECT id, value FROM limits WHERE label = 'max-file-upload-size'",
      { type: Sequelize.QueryTypes.SELECT },
    );

    for (const limit of maxFileUploadSizeLimits) {
      const bytesValue = convertBytesToGB(parseInt(limit.value)).toString();

      await queryInterface.sequelize.query(
        'UPDATE limits SET value = :bytesValue WHERE id = :id',
        {
          replacements: { bytesValue, id: limit.id },
          type: Sequelize.QueryTypes.UPDATE,
        },
      );
    }
  },
};
