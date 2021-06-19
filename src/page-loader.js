// @ts-check
import { URL } from 'url';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { writeFile, mkdir } from 'fs/promises';
import { createWriteStream } from 'fs';
import _ from 'lodash';
import path from 'path';

const urlToFilename = (urlString) => {
  const url = new URL(urlString);
  const resource = url.pathname.split('.');
  const urlWithoutProtocol = _.trim(`${url.host}${resource[0]}`, '/');

  if (resource.length > 1) {
    return `${urlWithoutProtocol.replace(/[\W_]+/g, '-')}.${resource[1]}`;
  }

  return `${urlWithoutProtocol.replace(/[\W_]+/g, '-')}`;
};

const urlToFilepath = (urlString, outputPath) => path.join(outputPath, urlToFilename(urlString));

const downloadResource = async (sourceUrl, targetPath) => {
  // axios file download with response type "stream"
  const response = await axios({
    method: 'GET',
    url: sourceUrl,
    responseType: 'stream',
  });
  // pipe the result stream into a file on disc
  response.data.pipe(createWriteStream(targetPath));
  // return a promise and resolve when download finishes
  return new Promise((resolve, reject) => {
    response.data.on('end', () => {
      resolve();
    });
    response.data.on('error', () => {
      reject();
    });
  });
};

const replaceResources = (urlString, content, outputPath) => {
  const supportedTags = {
    img: 'src',
    script: 'src',
    link: 'href',
  };

  const url = new URL(urlString);
  const $ = cheerio.load(content);

  const resources = [];
  Object.entries(supportedTags).forEach(([tag, srcAttribute]) => {
    $(tag).each((i, resource) => {
      const resourceSrc = _.trim(resource.attribs[srcAttribute], '/');

      let resourceUrl;
      if (resourceSrc.startsWith('http')) {
        // skip third party domains
        if (!resourceSrc.includes(url.host)) return;
        resourceUrl = resourceSrc;
      } else {
        resourceUrl = `${url.protocol}//${url.host}/${resourceSrc}`;
      }

      // build filename
      const resourcePath = path.join(`${urlToFilepath(urlString, outputPath)}_files`, urlToFilename(resourceUrl));
      // prepare list to download
      resources.push({
        remote: resourceUrl,
        filepath: resourcePath,
      });
      // replace attr with local filepath
      resource.attribs[srcAttribute] = path.join(`${urlToFilename(urlString)}_files`, urlToFilename(resourceUrl));
    });
  });

  return {
    html: $.html(),
    resources,
  };
};

export default async (urlString, outputPath) => {
  const page = await axios.get(urlString);
  const newPage = replaceResources(urlString, page.data, outputPath);
  // console.log(newPage.resources);

  if (newPage.resources) {
    const resourcesPath = `${urlToFilepath(urlString, outputPath)}_files`;
    await mkdir(resourcesPath).catch((err) => {
      if (err.code === 'EEXIST') return;
      throw err;
    });

    const promises = newPage.resources
      .map((resource) => downloadResource(resource.remote, resource.filepath));
    await Promise.all(promises);
  }
  const filename = `${urlToFilepath(urlString, outputPath)}.html`;
  await writeFile(filename, newPage.html);

  return {
    filepath: filename,
    resourceFiles: newPage.resources.map((resource) => resource.filepath),
  };
};
