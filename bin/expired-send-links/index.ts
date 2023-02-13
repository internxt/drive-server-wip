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
  moveToDeletedFiles,
  clearExpiredSendLink,
  clearExpiredSendLinkItems,
} from './utils';

const commands: { flags: string; description: string; required: boolean }[] = [
  {
    flags: '--db-hostname <database_hostname>',
    description: 'The hostname of the database where deleted files are stored',
    required: true,
  },
  {
    flags: '--db-name <database_name>',
    description: 'The name of the database where deleted files are stored',
    required: true,
  },
  {
    flags: '--db-username <database_username>',
    description:
      'The username authorized to read and delete from the deleted files table',
    required: true,
  },
  {
    flags: '--db-password <database_password>',
    description: 'The database username password',
    required: true,
  },
  {
    flags: '--db-port <database_port>',
    description: 'The database port',
    required: true,
  },
  {
    flags: '--send-userid <send_userid>',
    description: 'The user id from Send',
    required: true,
  },
  {
    flags: '--send-folderid <send_folderid>',
    description: 'The folder id from Send user where files are stored',
    required: true,
  },
  {
    flags: '--send-bucketid <send_bucketid>',
    description: 'The bucket id from Send user',
    required: true,
  },
  {
    flags: '-l, --limit <limit>',
    description: 'The files limit to handle each time',
    required: false,
  },
];

const command = new Command('expired-send-links').version('0.0.1');

commands.forEach((c) => {
  if (c.required) {
    command.requiredOption(c.flags, c.description);
  } else {
    command.option(c.flags, c.description);
  }
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

    console.time('df-network-req');

    for (const expiredLink of expiredLinks) {
      for (const expiredLinkItem of expiredLink.items) {
        await moveToDeletedFiles(
          DeletedFilesRepository,
          expiredLinkItem,
          Number(opts.sendUserid),
          Number(opts.sendFolderid),
          String(opts.sendBucketid),
        );
      }
      await clearExpiredSendLinkItems(SendLinkItemRepository, expiredLink);
      await clearExpiredSendLink(SendLinkRepository, expiredLink);
    }

    console.timeEnd('df-network-req');

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
