// @ts-check
import { URL } from 'url';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { writeFile, mkdir } from 'fs/promises';
import { createWriteStream } from 'fs';
import _ from 'lodash';
import path from 'path';

const buildFilename = (urlString) => {
  const url = new URL(urlString);
  const urlWithoutProtocol = _.trim(`${url.host}${url.pathname}`, '/');

  return `${urlWithoutProtocol.replace(/[\W_]+/g, '-')}`;
};

const downloadImage = async (imageUrl, imagePath) => {
  // axios image download with response type "stream"
  const response = await axios({
    method: 'GET',
    url: imageUrl,
    responseType: 'stream',
  });
  // pipe the result stream into a file on disc
  response.data.pipe(createWriteStream(imagePath));
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

const replaceImages = (urlString, content, outputPath) => {
  const url = new URL(urlString);
  const $ = cheerio.load(content);

  const resources = [];
  $('img').each((i, image) => {
    const imgSrc = image.attribs.src;
    if (imgSrc.startsWith('http') && !imgSrc.includes(url.host)) {
      // skip third party domains
      return;
    }
    const imageUrl = `${url.protocol}//${url.host}${imgSrc}`;

    // build filename
    const imagePath = path.join(outputPath, `${buildFilename(urlString)}_files`, buildFilename(imageUrl));
    // prepare list to download
    resources.push({
      resourceUrl: imageUrl,
      filepath: imagePath,
    });
    // replace src
    image.attribs.src = path.join(`${buildFilename(urlString)}_files`, buildFilename(imageUrl));
  });

  return {
    html: $.html(),
    resources,
  };
};

export default async (urlString, outputPath) => {
  const page = await axios.get(urlString);
  const newPage = replaceImages(urlString, page.data, outputPath);

  if (newPage.resources) {
    const resourcesPath = path.join(outputPath, `${buildFilename(urlString)}_files`);
    await mkdir(resourcesPath);

    const promises = newPage.resources.map((img) => downloadImage(img.resourceUrl, img.filepath));
    await Promise.all(promises);
  }
  const filename = path.join(outputPath, `${buildFilename(urlString)}.html`);
  await writeFile(filename, newPage.html);

  return {
    filepath: filename,
    resourceFiles: newPage.resources.map((img) => img.filepath),
  };
};
