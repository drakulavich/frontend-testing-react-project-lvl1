import _ from 'lodash';

const uniq = (elements) => _.uniq(elements);

const urlToFilename = (urlString, defaultExtension = '.html') => {
  const url = new URL(urlString);
  const resource = url.pathname.split('.');
  const urlWithoutProtocol = _.trim(`${url.host}${resource[0]}`, '/');
  const sanitized = urlWithoutProtocol.replace(/[\W_]+/g, '-');

  return ((resource.length > 1) ? `${sanitized}.${resource.slice(1).join('.')}` : `${sanitized}${defaultExtension}`);
};

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

export { uniq, urlToFilename, getResourceUrl };
