// @ts-check

import nock from 'nock';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import loadPage from '../index.js';

const getFixturePath = (filename) => path.join(__dirname, '..', '__fixtures__', filename);

let tempPath;
let expectedHtml;

describe('page-loader', () => {
  beforeAll(() => {
    nock.disableNetConnect();
  });

  beforeEach(async () => {
    tempPath = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('positive cases', () => {
    beforeEach(async () => {
      expectedHtml = await fs.readFile(getFixturePath('/expected/hexlet-courses-result.html'), 'utf-8');

      const resources = [
        { path: '/courses', fixture: 'hexlet-courses.html', contentType: 'text/html; charset=UTF-8' },
        { path: '/assets/professions/nodejs.png', fixture: 'nodejs.png', contentType: 'image/png' },
        { path: '/assets/testing/pyramid.jpeg', fixture: 'pyramid.jpeg', contentType: 'image/jpeg' },
        { path: '/assets/application.css', fixture: 'application.css', contentType: 'text/css' },
        { path: '/packs/js/runtime.js', fixture: 'runtime.js', contentType: 'text/javascript' },
      ];

      resources.forEach((resource) => {
        nock('https://ru.hexlet.io')
          .persist()
          .get(resource.path)
          .replyWithFile(200, getFixturePath(resource.fixture), {
            'Content-Type': resource.contentType,
          });
      });
    });

    it('should download page with resources', async () => {
      const { filepath } = await loadPage('https://ru.hexlet.io/courses', tempPath);
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
        const expectedFile = await fs.readFile(getFixturePath(asset.in));
        const resultFile = await fs.readFile(path.join(tempPath, 'ru-hexlet-io-courses_files', asset.out));

        expect(expectedFile.equals(resultFile)).toBeTruthy();
      }));
    });
  });

  describe('negative cases', () => {
    beforeEach(async () => {
      nock('https://ru.hexlet.io')
        .get('/courses')
        .replyWithFile(200, getFixturePath('hexlet-courses.html'), {
          'Content-Type': 'text/html; charset=UTF-8',
        });
    });

    it('should handle filesystem errors', async () => {
      const notExistingPath = path.join(tempPath, 'not_existing_dir');
      await expect(loadPage('https://ru.hexlet.io/courses', notExistingPath)).rejects.toThrow();
    });

    test.each([
      401,
      403,
      404,
      500,
    ])('should handle %d errors', async (errorCode) => {
      nock('https://ru.hexlet.io')
        .get('/pagewitherror')
        .reply(errorCode);

      await expect(loadPage('https://ru.hexlet.io/pagewitherror', tempPath)).rejects.toThrow();
    });
  });
});
