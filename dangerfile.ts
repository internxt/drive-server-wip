import { danger, warn, message } from 'danger';

const onAPrWeWantTo = (fns: (() => void)[]) => fns.forEach((fn) => fn());

function provideAGoodDescription() {
  const includesDescription =
    danger.github.pr.body && danger.github.pr.body.length > 10;

  if (!includesDescription) {
    warn('Please include a description of your PR changes.');
  }

  const mandatorySections = [
    'What does this PR do?',
    'Why are we doing this?',
    'How are we doing this?',
    'Should this be manually tested & how?',
    'Any background context you want to provide?',
  ];

  const sections = danger.github.pr.body.split('\n');
  const missingSections = mandatorySections.filter(
    (section) => !sections.includes(section),
  );

  if (missingSections.length > 0) {
    warn(
      `Please include the following sections in the PR description: ${missingSections.join(
        ', ',
      )}`,
    );
  }
}

function keepLockfileUpToDate() {
  const packageChanged = danger.git.modified_files.includes('package.json');
  const lockfileChanged = danger.git.modified_files.includes('yarn.lock');
  if (packageChanged && !lockfileChanged) {
    const message = 'Changes were made to package.json, but not to yarn.lock';
    const idea = 'Perhaps you need to run `yarn install`?';
    warn(`${message} - <i>${idea}</i>`);
  }
}

function keepItShort() {
  const warningMessage =
    'PR size seems relatively large. If PR contains multiple changes, split each into separate PR will helps faster, easier review.';
  const bigPRThreshold = 600;
  const affectedLines = danger.github.pr.additions + danger.github.pr.deletions;
  if (affectedLines > bigPRThreshold) {
    warn(
      `:exclamation:  ${warningMessage} lines :exclamation:  ${warningMessage}`,
    );
  } else {
    message(`The PR size is nice! :white_check_mark:`);
  }
}

function avoidNewDeadCode() {
  // Get info from github to know if some unused code was added
  // Use external tool
}

onAPrWeWantTo([
  provideAGoodDescription,
  keepLockfileUpToDate,
  keepItShort,
  avoidNewDeadCode,
]);
