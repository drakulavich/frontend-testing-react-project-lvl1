// @ts-check
import * as cheerio from 'cheerio';
import _ from 'lodash';
import axios from 'axios';
// eslint-disable-next-line no-unused-vars
import axiosDebugLog from 'axios-debug-log';
import { writeFile, mkdir } from 'fs/promises';
import debug from 'debug';
import path from 'path';
import { getResourceUrl, urlToFilename } from './utils.js';
import ResourceAccessError from './errors/resource-error.js';
import FsAccessError from './errors/fs-error.js';

const logApp = debug('page-loader');

const resourcesDir = (urlString, outputPath) => path.join(outputPath, `${urlToFilename(urlString, '')}_files`);

const downloadResource = async (sourceUrl) => axios.get(sourceUrl, { responseType: 'arraybuffer' });

const replaceToLocalResources = (pageUrl, content) => {
  const supportedTags = {
    img: 'src',
    script: 'src',
    link: 'href',
  };
  const $ = cheerio.load(content);

  const resources = [];
  Object.entries(supportedTags).forEach(([tag, srcAttribute]) => {
    $(tag).each((i, resource) => {
      const element = $(resource);
      const resourceUrl = getResourceUrl(pageUrl, element.attr(srcAttribute));
      if (!resourceUrl) return;

      // replace attr with RELATIVE local filepath
      element.attr(srcAttribute, path.join(resourcesDir(pageUrl, ''), urlToFilename(resourceUrl)));
      resources.push(resourceUrl);
    });
  });

  return {
    html: $.html(),
    resources: _.uniq(resources),
  };
};

export default async (pageUrl, outputPath = process.cwd()) => {
  logApp('Download %s page to %s local path', pageUrl, outputPath);

  const page = await downloadResource(pageUrl).catch((err) => {
    throw new ResourceAccessError(`${pageUrl} main page fetching: ${err.message}`);
  });
  const newPage = replaceToLocalResources(pageUrl, page.data);
  logApp('Resources detected on page %s: %O', pageUrl, newPage.resources);

  if (newPage.resources) {
    const resourcesPath = resourcesDir(pageUrl, outputPath);
    await mkdir(resourcesPath).catch((err) => {
      if (err.code === 'EEXIST') return;
      throw new FsAccessError(`Can not create resources directory ${resourcesPath}: ${err.message}`);
    });

    const promises = newPage.resources
      .map((resource) => downloadResource(resource)
        .then((result) => {
          const localFilename = path.join(resourcesPath, urlToFilename(resource));
          writeFile(localFilename, result.data);
        })
        // Ignore resource download errors
        .catch(() => logApp(`Failed to download resource ${resource}`)));
    await Promise.all(promises);
  }
  const filepath = path.join(outputPath, urlToFilename(pageUrl));
  logApp('Page downloaded to %s', filepath);
  await writeFile(filepath, newPage.html).catch((err) => {
    throw new FsAccessError(`Can not save ${filepath}: ${err.message}`);
  });

  return {
    filepath,
  };
};
