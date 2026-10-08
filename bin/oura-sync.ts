#!/usr/bin/env node
import { formatError, main } from '../src/cli.ts';

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(formatError(err));
    process.exitCode = 1;
  },
);
