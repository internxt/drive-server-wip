'use strict';

const tableName = 'files';

module.exports = {
  async up(queryInterface, Sequelize) {
    const batchSize = 1000;
    let offset = 649000;
    let updatedRowCount = offset;

    // Set the status field to 'TRASHED' for rows where deleted=true and removed=false
    do {
      const [updatedRows] = await queryInterface.sequelize.query(
        `UPDATE ${tableName} SET status = 'TRASHED', updated_at = deleted_at 
          WHERE id IN (
            SELECT id FROM ${tableName} WHERE deleted = true AND removed = false 
            ORDER BY id ASC 
            LIMIT ${batchSize} OFFSET ${offset}
          )
        RETURNING *;`,
      );

      if (updatedRows.length === 0) {
        break;
      }

      updatedRowCount += updatedRows.length;
      offset += batchSize;

      console.log(new Date(), `Updated ${updatedRowCount} rows to 'TRASHED'`);
    } while (updatedRowCount % batchSize === 0);

    console.log(`Updated ${updatedRowCount} rows to 'TRASHED'`);

    updatedRowCount = 0;
    offset = 0;

    // Set the status field to 'DELETED' for rows where removed=true
    do {
      const [updatedRows] = await queryInterface.sequelize.query(
        `UPDATE ${tableName} SET status = 'DELETED', updated_at = removed_at 
          WHERE id IN (
            SELECT id FROM ${tableName} WHERE removed = true 
            ORDER BY id ASC 
            LIMIT ${batchSize} OFFSET ${offset}
          )
          RETURNING *;`,
      );

      if (updatedRows.length === 0) {
        break;
      }

      updatedRowCount += updatedRows.length;
      offset += batchSize;

      console.log(`Updated ${offset + updatedRowCount} rows to 'DELETED'`);
    } while (updatedRowCount % batchSize === 0);

    console.log(`Updated ${updatedRowCount} rows to 'DELETED'`);
  },

  async down(queryInterface) {
    // Revert the changes made in the up function
    await queryInterface.sequelize.query(
      `UPDATE ${tableName} SET status = null, updated_at = null WHERE deleted = true AND removed = false`,
    );
    await queryInterface.sequelize.query(
      `UPDATE ${tableName} SET status = null, updated_at = null WHERE removed = true`,
    );
  },
};
