'use strict';

const SOURCE_TABLE = 'deleted_files';
const TARGET_TABLE = 'deleted_files_old_records';
const CHECKPOINT_TABLE = 'migration_checkpoint';
const OLD_INDEX_NAME = 'deleted_files_files_to_delete_idx';
const NEW_INDEX_NAME = 'deleted_files_updated_at_id_idx';
const CUTOFF_DATE = '2026-02-26 00:00:00';
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
const BATCH_SIZE = 10000;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;

    // No longer useful index
    await sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS ${OLD_INDEX_NAME}`,
    );

    // Index used for the keyset pagination
    await sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS ${NEW_INDEX_NAME}
      ON ${SOURCE_TABLE} (updated_at, file_id)
    `);

    // Target table: same columns as deleted_files
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ${TARGET_TABLE} (
        file_id uuid NOT NULL,
        processed bool DEFAULT false,
        created_at timestamp,
        updated_at timestamp,
        processed_at timestamp,
        enqueued bool DEFAULT false,
        enqueued_at timestamp,
        network_file_id varchar(24) NOT NULL DEFAULT ''
      )
    `);

    // Checkpoint table to track progress and resume if the script stops
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ${CHECKPOINT_TABLE} (
        table_name text PRIMARY KEY,
        last_updated_at timestamp NOT NULL,
        last_id uuid NOT NULL,
        rows_migrated bigint NOT NULL DEFAULT 0,
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    // Fetch checkpoint if it exists (so we can resume if the script stops)
    const [[checkpoint]] = await sequelize.query(`
      SELECT last_updated_at, last_id, rows_migrated
      FROM ${CHECKPOINT_TABLE}
      WHERE table_name = '${TARGET_TABLE}'
    `);

    let lastUpdatedAt = checkpoint?.last_updated_at ?? CUTOFF_DATE;
    let lastId = checkpoint?.last_id ?? ZERO_UUID;
    let rowsMigrated = Number(checkpoint?.rows_migrated ?? 0);

    if (!checkpoint) {
      await sequelize.query(
        `
        INSERT INTO ${CHECKPOINT_TABLE} (table_name, last_updated_at, last_id, rows_migrated)
        VALUES ('${TARGET_TABLE}', :cutoff, :lastId, 0)
        `,
        { replacements: { cutoff: CUTOFF_DATE, lastId } },
      );
    } else {
      console.log(
        `[migrate-deleted-files] resuming from checkpoint: rows_migrated=${rowsMigrated}, last_id=${lastId}`,
      );
    }

    const startedAt = Date.now();
    let batchRows = BATCH_SIZE;

    while (batchRows === BATCH_SIZE) {
      const batchStart = Date.now();

      const [rows] = await sequelize.query(
        `
        SELECT file_id, processed, created_at, updated_at, processed_at,
               enqueued, enqueued_at, network_file_id
        FROM ${SOURCE_TABLE}
        WHERE (updated_at, file_id) > (:lastUpdatedAt, :lastId)
          AND updated_at >= :cutoff
        ORDER BY updated_at, file_id
        LIMIT :batchSize
        `,
        {
          replacements: {
            lastUpdatedAt,
            lastId,
            cutoff: CUTOFF_DATE,
            batchSize: BATCH_SIZE,
          },
        },
      );

      batchRows = rows.length;
      if (batchRows === 0) {
        break;
      }

      const last = rows[rows.length - 1];

      const t = await sequelize.transaction();
      try {
        await queryInterface.bulkInsert(TARGET_TABLE, rows, {
          ignoreDuplicates: true,
          transaction: t,
        });

        await sequelize.query(
          `
          UPDATE ${CHECKPOINT_TABLE}
          SET last_updated_at = :lastUpdatedAt, last_id = :lastId,
              rows_migrated = rows_migrated + :batchRows, updated_at = now()
          WHERE table_name = '${TARGET_TABLE}'
          `,
          {
            replacements: {
              lastUpdatedAt: last.updated_at,
              lastId: last.file_id,
              batchRows,
            },
            transaction: t,
          },
        );

        await t.commit();
      } catch (err) {
        await t.rollback();
        console.error(
          `[migrate-deleted-files] batch FAILED after last_id=${lastId}, checkpoint intact. Re-run to resume. Error:`,
          err.message,
        );
        throw err;
      }

      lastUpdatedAt = last.updated_at;
      lastId = last.file_id;
      rowsMigrated += batchRows;

      const batchSec = (Date.now() - batchStart) / 1000;
      const totalSec = (Date.now() - startedAt) / 1000;
      console.log(
        `[migrate-deleted-files] batch=${batchRows} rows | ${(batchRows / batchSec).toFixed(0)} rows/sec | ` +
          `total=${rowsMigrated} | elapsed=${totalSec.toFixed(0)}s`,
      );
    }

    console.log(`[migrate-deleted-files] FINISHED. total=${rowsMigrated}`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS ${NEW_INDEX_NAME}`,
    );

    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS ${OLD_INDEX_NAME}
      ON ${SOURCE_TABLE} USING btree (updated_at) INCLUDE (file_id)
      WHERE updated_at < '${CUTOFF_DATE}'
    `);
  },
};
