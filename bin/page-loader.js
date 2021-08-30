#!/usr/bin/env node

import { Command } from 'commander/esm.mjs';
import loadPage from '../index.js';
import FsAccessError from '../src/errors/fs-error.js';
import ResourceAccessError from '../src/errors/resource-error.js';

const program = new Command();

program
  .arguments('<pageURL>')
  .option('-o, --output <filepath>', 'output path for the webpage', process.cwd())
  .action((pageURL, options) => {
    loadPage(pageURL, options.output)
      .then((result) => console.log(result.filepath))
      .catch((err) => {
        if (err instanceof ResourceAccessError) {
          console.error(err);
          process.exit(1);
        } else if (err instanceof FsAccessError) {
          console.error(err);
          process.exit(2);
        }
        // Unknown Error
        console.error(err);
        process.exit(128);
      });
  });

program.parse(process.argv);
