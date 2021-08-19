// @ts-check

import nock from 'nock';
import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import os from 'os';
import loadPage from '../src/page-loader.js';

const getFixturePath = (filename) => path.join(__dirname, '..', '__fixtures__', filename);

const fileHash = async (filename) => {
  const buffer = await fs.readFile(filename);
  return crypto.createHash('md5')
    .update(buffer)
    .digest('hex');
};

let tempPath;

describe('page-loader', () => {
  beforeEach(async () => {
    nock.disableNetConnect();

    tempPath = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it('should download page with resources', async () => {
    nock('https://ru.hexlet.io')
      .persist()
      .get('/courses')
      .replyWithFile(200, getFixturePath('hexlet-courses.html'), {
        'Content-Type': 'text/html; charset=UTF-8',
      })
      .get('/assets/professions/nodejs.png')
      .replyWithFile(200, getFixturePath('nodejs.png'), {
        'Content-Type': 'image/png',
      })
      .get('/assets/testing/pyramid.jpeg')
      .replyWithFile(200, getFixturePath('pyramid.jpeg'), {
        'Content-Type': 'image/jpeg',
      })
      .get('/assets/application.css')
      .replyWithFile(200, getFixturePath('application.css'), {
        'Content-Type': 'text/css',
      })
      .get('/packs/js/runtime.js')
      .replyWithFile(200, getFixturePath('runtime.js'), {
        'Content-Type': 'text/javascript',
      });

    const { filepath } = await loadPage('https://ru.hexlet.io/courses', tempPath);

    const expectedHtml = await fs.readFile(getFixturePath('/expected/hexlet-courses-result.html'), 'utf-8');
    const resultHtml = await fs.readFile(filepath, 'utf-8');
    expect(resultHtml).toEqual(expectedHtml);

    const assetsToCheck = [
      { in: 'nodejs.png', out: 'ru-hexlet-io-assets-professions-nodejs.png' },
      { in: 'pyramid.jpeg', out: 'ru-hexlet-io-assets-testing-pyramid.jpeg' },
      { in: 'application.css', out: 'ru-hexlet-io-assets-application.css' },
      { in: 'runtime.js', out: 'ru-hexlet-io-packs-js-runtime.js' },
      { in: 'hexlet-courses.html', out: 'ru-hexlet-io-courses.html' },
    ];

    await Promise.all(assetsToCheck.map(async (asset) => {
      const expectedHash = await fileHash(getFixturePath(asset.in));
      const resultHash = await fileHash(path.join(tempPath, 'ru-hexlet-io-courses_files', asset.out));

      expect(expectedHash).toEqual(resultHash);
    }));
  });

  it('should handle filesystem errors', async () => {
    nock('http://test.com')
      .get('/books')
      .reply(200);

    const notExistingPath = path.join(tempPath, 'not_existing_dir');
    await expect(loadPage('http://test.com/books', notExistingPath)).rejects.toThrow();
  });

  it('should handle resource access errors', async () => {
    nock('https://ru.hexlet.io')
      .persist()
      .get('/courses')
      .replyWithFile(200, getFixturePath('hexlet-courses.html'), {
        'Content-Type': 'text/html; charset=UTF-8',
      })
      .get('/packs/js/runtime.js')
      .replyWithFile(500, getFixturePath('runtime.js'), {
        'Content-Type': 'text/javascript',
      });

    await expect(loadPage('https://ru.hexlet.io/courses', tempPath)).rejects.toThrow();
  });
});
