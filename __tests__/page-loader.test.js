// @ts-check

import nock from 'nock';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import loadPage from '../src/page-loader.js';

let tempPath;

describe('page-loader', () => {
  beforeEach(async () => {
    tempPath = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
  });

  it('should download page to the specified path', async () => {
    nock('http://example.com')
      .get('/users')
      .reply(200, 'Response here');

    const filepath = await loadPage('http://example.com/users', tempPath);
    const fileContent = await fs.readFile(filepath, 'utf-8');

    expect(fileContent).toEqual('Response here');
  });
});
