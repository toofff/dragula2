#!/usr/bin/env node

const { spawn } = require('child_process');

const analyzer = (args, isLaunchedInternally = false, mustFix = false) => {
  const defaultArgs = [
    '--config',
    isLaunchedInternally ? './.prettierrc.json' : './node_modules/@tools/lint/.prettierrc.json',
    '--list-different',
  ];
  const allArgs = [...defaultArgs, ...args];
  if (mustFix) {
    allArgs.push('--write');
  }

  const prettier = spawn('prettier', allArgs);
  prettier.stdout.on('data', (data) => {
    console.info(`==> ${data}`);
  });
  prettier.stderr.on('data', (data) => {
    console.error(` == FORMATTER - ERROR ==\n${data}`);
  });
  prettier.on('close', (code) => {
    process.exit(code);
  });
};

const args = process.argv.slice(2);
analyzer(
  args.filter((arg) => !['--fix', '--internal'].includes(arg)),
  args.includes('--internal'),
  args.includes('--fix'),
);
