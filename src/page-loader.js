// @ts-check
import { URL } from 'url';
import * as cheerio from 'cheerio';
import axios from 'axios';
// eslint-disable-next-line no-unused-vars
import axiosDebugLog from 'axios-debug-log';
import { writeFile, mkdir } from 'fs/promises';
import _ from 'lodash';
import debug from 'debug';
import path from 'path';
import ResourceAccessError from './errors/resource-error.js';
import FsAccessError from './errors/fs-error.js';

const logApp = debug('page-loader');

const urlToFilename = (urlString, defaultExtension = '') => {
  const url = new URL(urlString);
  const resource = url.pathname.split('.');
  const urlWithoutProtocol = _.trim(`${url.host}${resource[0]}`, '/');
  const sanitized = urlWithoutProtocol.replace(/[\W_]+/g, '-');

  if (resource.length > 1) {
    // append the original extension
    return `${sanitized}.${resource.slice(1).join('.')}`;
  }
  return `${sanitized}${defaultExtension}`;
};

const resourcesDir = (urlString, outputPath) => path.join(outputPath, `${urlToFilename(urlString)}_files`);

const downloadResource = async (sourceUrl) => axios.get(sourceUrl, { responseType: 'arraybuffer' });

const getResourceUrl = (pageUrl, source) => {
  const pageUrlObj = new URL(pageUrl);
  let result;

  if (source.includes('base64')) {
    return result;
  }
  if (source.startsWith('http')) {
    // skip third party domains
    const resourceUrlObj = new URL(source);
    if (pageUrlObj.host !== resourceUrlObj.host) return result;
    result = source;
  } else {
    // build full URL for resources like '/assets/me.jpg'
    result = `${pageUrlObj.protocol}//${pageUrlObj.host}${source}`;
  }

  return result;
};

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
      element.attr(srcAttribute, path.join(resourcesDir(pageUrl, ''), urlToFilename(resourceUrl, '.html')));
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
          const localFilename = path.join(resourcesPath, urlToFilename(resource, '.html'));
          writeFile(localFilename, result.data);
        })
        .catch((err) => {
          throw new ResourceAccessError(`${resource} resource downloading: ${err.message}`);
        }));
    await Promise.all(promises);
  }
  const filepath = path.join(outputPath, urlToFilename(pageUrl, '.html'));
  logApp('Page downloaded to %s', filepath);
  await writeFile(filepath, newPage.html).catch((err) => {
    throw new FsAccessError(`Can not save ${filepath}: ${err.message}`);
  });

  return {
    filepath,
  };
};
