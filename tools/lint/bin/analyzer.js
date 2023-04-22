#!/usr/bin/env node

// const { spawn } = require('child_process');
import { spawn } from 'node:child_process';

const analyzer = (args, isLaunchedInternally = false, mustFix = false) => {
  const defaultArgs = [
    '--config',
    isLaunchedInternally ? './.eslintrc.json' : './node_modules/@tools/lint/.eslintrc.json',
    '--color',
    '--no-inline-config',
  ];
  const allArgs = [...defaultArgs, ...args];
  if (mustFix) {
    allArgs.push('--fix');
  }

  const eslint = spawn('eslint', allArgs);
  eslint.stdout.on('data', (data) => {
    console.info(` == ANALYZER ==\n${data}`);
  });
  eslint.stderr.on('data', (data) => {
    console.error(` == ANALYZER - ERROR ==\n${data}`);
  });
  eslint.on('close', (code) => {
    process.exit(code);
  });
};

const args = process.argv.slice(2);
analyzer(
  args.filter((arg) => !['--fix', '--internal'].includes(arg)),
  args.includes('--internal'),
  args.includes('--fix'),
);
