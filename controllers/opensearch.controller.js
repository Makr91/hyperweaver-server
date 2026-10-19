import { loadConfig } from '../utils/config-loader.js';

const NAME = 'Hyperweaver';
const LOGO = '/brand/hyperweaver/mark.svg';

const XML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

/**
 * A value escaped for XML text and attribute values.
 * @param {string} value - The value
 * @returns {string} The escaped value
 */
const xml = value => String(value).replace(/[&<>"']/g, character => XML_ENTITIES[character]);

/**
 * @swagger
 * /opensearch.xml:
 *   get:
 *     summary: OpenSearch description of this host (public)
 *     description: An OpenSearch 1.1 description, so a browser can add the site as a search engine. ShortName is the brand name; Description is "Search" and the ShortName; Image is the brand logo_url written as an absolute URL on frontend.frontend_url; the text/html Url template opens the search page at that origin.
 *     tags: [Search]
 *     responses:
 *       200:
 *         description: The OpenSearch description
 *         headers:
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: no-cache
 *         content:
 *           application/opensearchdescription+xml:
 *             schema:
 *               type: string
 *               example: <?xml version="1.0" encoding="UTF-8"?><OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/"><ShortName>Hyperweaver</ShortName><Description>Search Hyperweaver</Description><InputEncoding>UTF-8</InputEncoding><Image>https://hyperweaver.example.com/brand/hyperweaver/mark.svg</Image><Url type="text/html" template="https://hyperweaver.example.com/search?q={searchTerms}"/></OpenSearchDescription>
 */
const opensearch = (req, res) => {
  void req;
  const { origin } = new URL(loadConfig('app').frontend.frontend_url);
  const name = NAME;
  const logo = LOGO;
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">',
    `  <ShortName>${xml(name)}</ShortName>`,
    `  <Description>${xml(`Search ${name}`)}</Description>`,
    '  <InputEncoding>UTF-8</InputEncoding>',
    `  <Image>${xml(`${origin}${logo}`)}</Image>`,
    `  <Url type="text/html" template="${xml(`${origin}/search?q={searchTerms}`)}"/>`,
    '</OpenSearchDescription>',
    '',
  ].join('\n');
  return res
    .set('Cache-Control', 'no-cache')
    .type('application/opensearchdescription+xml')
    .send(body);
};

export { opensearch };
