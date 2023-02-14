import { Command } from 'commander';
import Database from '../../src/config/initializers/database';
import { UserModel } from '../../src/modules/user/user.model';
import { FolderModel } from '../../src/modules/folder/folder.model';
import { SendLinkItemModel } from '../../src/modules/send/send-link-item.model';
import { DeletedFileModel } from '../../src/modules/deleted-file/deleted-file.model';
import { SendLinkModel } from '../../src/modules/send/send-link.model';
import { SendLinkAttributes } from '../../src/modules/send/send-link.domain';
import { ModelType } from 'sequelize-typescript';
import {
  createTimer,
  getExpiredSendLinks,
  moveItemsToDeletedFiles,
  clearExpiredSendLink,
  clearExpiredSendLinkItems,
} from './utils';

const commands: { flags: string; description: string }[] = [
  {
    flags: '--db-hostname <database_hostname>',
    description: 'The database hostname',
  },
  {
    flags: '--db-name <database_name>',
    description: 'The database name',
  },
  {
    flags: '--db-username <database_username>',
    description:
      'The username authorized to create from deleted_files table and read/delete from send_links and send_link_items',
  },
  {
    flags: '--db-password <database_password>',
    description: 'The database username password',
  },
  {
    flags: '--db-port <database_port>',
    description: 'The database port',
  },
  {
    flags: '--user-id <user_id>',
    description: 'The user owner of the files',
  },
  {
    flags: '--folder-id <folder_id>',
    description: 'The folder id where files are stored',
  },
  {
    flags: '--bucket-id <bucket_id>',
    description: 'The bucket id where the files are stored in the network',
  },
  {
    flags: '-l, --limit [limit]',
    description: 'The files limit to handle each time',
  },
];

const command = new Command('expired-send-links').version('0.0.1');

commands.forEach((c) => {
  command.option(c.flags, c.description);
});

command.parse(process.argv);

const opts = command.opts();
const db = Database.getInstance({
  sequelizeConfig: {
    host: opts.dbHostname,
    port: opts.dbPort,
    database: opts.dbName,
    username: opts.dbUsername,
    password: opts.dbPassword,
    dialect: 'postgres',
    repositoryMode: true,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
});
db.addModels([
  SendLinkModel,
  UserModel,
  SendLinkItemModel,
  FolderModel,
  DeletedFileModel,
]);

const timer = createTimer();
timer.start();

let totalMovedExpiredLinks = 0;

const logIntervalId = setInterval(() => {
  console.log(
    'EXPIRED LINKS DELETED RATE: %s/s',
    totalMovedExpiredLinks / (timer.end() / 1000),
  );
}, 10000);

function finishProgram() {
  clearInterval(logIntervalId);

  console.log(
    'TOTAL EXPIRED LINKS DELETED %s | DURATION %ss',
    totalMovedExpiredLinks,
    (timer.end() / 1000).toFixed(2),
  );
  db.close()
    .then(() => {
      console.log('DISCONNECTED FROM DB');
    })
    .catch((err) => {
      console.log(
        'Error closing connection %s. %s',
        err.message.err.stack || 'NO STACK.',
      );
    });
}

process.on('SIGINT', () => finishProgram());

async function start(limit = 20) {
  const SendLinkRepository = db.getRepository(SendLinkModel);
  const SendLinkItemRepository = db.getRepository(SendLinkItemModel);
  const DeletedFilesRepository = db.getRepository(DeletedFileModel);
  const sendLinkItemModel = db.models.SendLinkItemModel as unknown as ModelType<
    SendLinkItemModel,
    SendLinkItemModel
  >;

  let expiredLinks: SendLinkAttributes[] = [];

  do {
    expiredLinks = await getExpiredSendLinks(
      SendLinkRepository,
      sendLinkItemModel,
      limit,
    );

    console.time('move-to-deleted-files');

    for (const expiredLink of expiredLinks) {
      for (let i = 0; i < expiredLink.items.length; i += 20) {
        await moveItemsToDeletedFiles(
          DeletedFilesRepository,
          expiredLink.items.slice(i, i + 20),
          Number(opts.sendUserid),
          Number(opts.sendFolderid),
          String(opts.sendBucketid),
        );
      }
      await clearExpiredSendLinkItems(SendLinkItemRepository, expiredLink);
      await clearExpiredSendLink(SendLinkRepository, expiredLink);
    }

    console.timeEnd('move-to-deleted-files');

    totalMovedExpiredLinks += expiredLinks.length;
  } while (expiredLinks.length === limit);
}

start(parseInt(opts.limit || '20'))
  .catch((err) => {
    console.log('err', err);
  })
  .finally(() => {
    finishProgram();
  });
