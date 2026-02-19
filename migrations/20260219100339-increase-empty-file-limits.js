'use strict';

const LIMIT_LABEL = 'max-zero-size-files';
const OLD_LIMIT_VALUE = '1000';
const NEW_LIMIT_VALUE = '10000';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const [limits] = await queryInterface.sequelize.query(
        `SELECT id, value FROM limits WHERE label = :LIMIT_LABEL`,
        {
          replacements: {
            LIMIT_LABEL,
          },
          transaction,
        },
      );

      const limitId = limits.find((l) => l.value === OLD_LIMIT_VALUE)?.id;

      if (!limitId) {
        throw new Error(`${LIMIT_LABEL} ${OLD_LIMIT_VALUE} limit not found`);
      }

      console.log(
        `Increasing ${LIMIT_LABEL} limit from ${OLD_LIMIT_VALUE} to ${NEW_LIMIT_VALUE}`,
      );

      await queryInterface.sequelize.query(
        `UPDATE limits
         SET value = :NEW_LIMIT_VALUE, updated_at = NOW()
         WHERE id = :limitId`,
        {
          replacements: {
            NEW_LIMIT_VALUE,
            limitId,
          },
          transaction,
        },
      );

      await transaction.commit();

      console.log(`Successfully increased ${LIMIT_LABEL} limit to ${NEW_LIMIT_VALUE}`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const [limits] = await queryInterface.sequelize.query(
        `SELECT id, value FROM limits WHERE label = :LIMIT_LABEL`,
        {
          replacements: {
            LIMIT_LABEL,
          },
          transaction,
        },
      );

      const limitId = limits.find((l) => l.value === NEW_LIMIT_VALUE)?.id;

      if (!limitId) {
        throw new Error(`${LIMIT_LABEL} ${NEW_LIMIT_VALUE} limit not found`);
      }

      console.log(
        `Rolling back ${LIMIT_LABEL} limit from ${NEW_LIMIT_VALUE} to ${OLD_LIMIT_VALUE}`,
      );

      await queryInterface.sequelize.query(
        `UPDATE limits
         SET value = :OLD_LIMIT_VALUE, updated_at = NOW()
         WHERE id = :limitId`,
        {
          replacements: {
            OLD_LIMIT_VALUE,
            limitId,
          },
          transaction,
        },
      );

      await transaction.commit();

      console.log(`Successfully rolled back ${LIMIT_LABEL} limit to ${OLD_LIMIT_VALUE}`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
