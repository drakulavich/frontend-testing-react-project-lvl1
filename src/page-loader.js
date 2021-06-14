// @ts-check
import { URL } from 'url';
import axios from 'axios';
import { writeFile } from 'fs/promises';
import _ from 'lodash';
import path from 'path';

const buildFilename = (urlString) => {
  const url = new URL(urlString);
  const urlWithoutProtocol = _.trim(`${url.host}${url.pathname}`, '/');

  return `${urlWithoutProtocol.replace(/[\W_]+/g, '-')}.html`;
};

export default async (urlString, outputPath) => {
  const filename = path.join(outputPath, buildFilename(urlString));
  const page = await axios.get(urlString);

  await writeFile(filename, page.data);

  return filename;
};
