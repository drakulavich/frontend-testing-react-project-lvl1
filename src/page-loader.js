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
    const imgSrc = _.trim(image.attribs.src, '/');
    if (imgSrc.startsWith('http') && !imgSrc.includes(url.host)) {
      // skip third party domains
      return;
    }
    const imageUrl = `${url.protocol}//${url.host}/${imgSrc}`;

    // build filename
    const imagePath = path.join(`${urlToFilepath(urlString, outputPath)}_files`, urlToFilename(imageUrl));
    // prepare list to download
    resources.push({
      resourceUrl: imageUrl,
      filepath: imagePath,
    });
    // replace src
    image.attribs.src = path.join(`${urlToFilename(urlString)}_files`, urlToFilename(imageUrl));
  });

  return {
    html: $.html(),
    resources,
  };
};

export default async (urlString, outputPath) => {
  const page = await axios.get(urlString);
  const newPage = replaceImages(urlString, page.data, outputPath);
  // console.log(newPage.resources);

  if (newPage.resources) {
    const resourcesPath = `${urlToFilepath(urlString, outputPath)}_files`;
    await mkdir(resourcesPath).catch((err) => {
      if (err.code === 'EEXIST') return;
      throw err;
    });

    const promises = newPage.resources.map((img) => downloadImage(img.resourceUrl, img.filepath));
    await Promise.all(promises);
  }
  const filename = `${urlToFilepath(urlString, outputPath)}.html`;
  await writeFile(filename, newPage.html);

  return {
    filepath: filename,
    resourceFiles: newPage.resources.map((img) => img.filepath),
  };
};
