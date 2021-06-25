// @ts-check

import nock from 'nock';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import loadPage from '../src/page-loader.js';

const getFixturePath = (filename) => path.join(__dirname, '..', '__fixtures__', filename);

let tempPath;

describe('page-loader', () => {
  beforeEach(async () => {
    tempPath = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
  });

  it('should download page to the specified path', async () => {
    nock('http://example.com')
      .get('/users')
      .reply(200, '<html><head></head><body>Response here</body></html>');

    const { filepath } = await loadPage('http://example.com/users', tempPath);
    const fileContent = await fs.readFile(filepath, 'utf-8');

    expect(fileContent).toEqual('<html><head></head><body>Response here</body></html>');
  });

  it('should download page with resources', async () => {
    nock('https://ru.hexlet.io')
      .persist()
      .get('/courses')
      .replyWithFile(200, getFixturePath('hexlet-courses.html'), {
        'Content-Type': 'text/html; charset=UTF-8',
      })
      .get('/assets/professions/nodejs.png')
      .replyWithFile(200, getFixturePath('nodejs_logo.png'), {
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

    const { filepath, resourceFiles } = await loadPage('https://ru.hexlet.io/courses', tempPath);

    const expectedHtml = await fs.readFile(getFixturePath('/expected/hexlet-courses-result.html'), 'utf-8');
    const resultHtml = await fs.readFile(filepath, 'utf-8');
    expect(resultHtml).toEqual(expectedHtml);

    const expectedImage = await fs.readFile(getFixturePath('nodejs_logo.png'));
    const resultImage = await fs.readFile(resourceFiles[0]);
    expect(resultImage).toEqual(expectedImage);
  });
});
