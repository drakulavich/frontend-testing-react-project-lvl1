#!/usr/bin/env node

import { Command } from 'commander/esm.mjs';
import loadPage from '../index.js';

const program = new Command();

program
  .arguments('<pageURL>')
  .option('-o, --output <filepath>', 'output path for the webpage', process.cwd())
  .action((pageURL, options) => {
    loadPage(pageURL, options.output)
      .then((result) => console.log(result.filepath));
  });

program.parse(process.argv);
