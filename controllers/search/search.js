import { log } from '../../utils/Logger.js';
import { problem, refuse } from '../../utils/problem.js';
import {
  MIN_QUERY_LENGTH,
  MAX_QUERY_LENGTH,
  parseLimit,
  parseKinds,
  parseScope,
  withinScope,
  cursorOf,
  offsetOf,
  wordsOf,
  buildContext,
} from './scope.js';
import { FINDERS } from './finders.js';

/**
 * The score of a title for the query's words: 3 when the title equals the
 * words joined by one space, 2 when it starts with them, 1 when every word
 * lies inside it, 0 otherwise.
 * @param {string} title - The lower-cased title
 * @param {string[]} words - The lower-cased query words
 * @returns {number} The score
 */
const nameScore = (title, words) => {
  const phrase = words.join(' ');
  if (title === phrase) {
    return 3;
  }
  if (title.startsWith(phrase)) {
    return 2;
  }
  return words.every(word => title.includes(word)) ? 1 : 0;
};

/**
 * The offsets of each word's first occurrence in a text, sorted by start,
 * the words the text does not hold left out.
 * @param {string} text - The matched field's text
 * @param {string[]} words - The lower-cased query words
 * @returns {Array<[number, number]>} The start and end of each span
 */
const spansOf = (text, words) => {
  const lower = text.toLowerCase();
  return words
    .map(word => [lower.indexOf(word), word.length])
    .filter(([start]) => start >= 0)
    .map(([start, length]) => [start, start + length])
    .sort((a, b) => a[0] - b[0]);
};

/**
 * The smallest position of any query word in a title, past every position
 * when the title holds none.
 * @param {string} title - The title
 * @param {string[]} words - The lower-cased query words
 * @returns {number} The position
 */
const positionOf = (title, words) => {
  const lower = title.toLowerCase();
  const positions = words.map(word => lower.indexOf(word)).filter(at => at >= 0);
  return positions.length > 0 ? Math.min(...positions) : Number.MAX_SAFE_INTEGER;
};

/**
 * A finder's row with its score and the spans of its highlight.
 * @param {Object} row - The row from the finders
 * @param {string[]} words - The lower-cased query words
 * @returns {Object} The result
 */
const ranked = (row, words) => {
  const { text } = row.highlight[row.matched];
  return {
    ...row,
    score: nameScore(row.title.toLowerCase(), words),
    highlight: { [row.matched]: { text, spans: spansOf(text, words) } },
  };
};

/**
 * The order of results: score descending, then the match position in the
 * title, then the title, then the id.
 * @param {string[]} words - The lower-cased query words
 * @returns {Function} The comparator
 */
const compareFor = words => (a, b) =>
  b.score - a.score ||
  positionOf(a.title, words) - positionOf(b.title, words) ||
  a.title.localeCompare(b.title) ||
  a.id.localeCompare(b.id);

/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: Search the whole app
 *     description: Case-insensitive substring search across this server's own kinds, every word of the query matching some field of the hit. host is the registry rows the person may list, matched on entity_name, hostname and description; machine is each visible agent's GET machines under the person's organization filter, matched on name, notes and tags, its id the registry id and the machine name joined by a slash; user is the local users within an administrator's reach, matched on username, email and name; organization is the local organizations the person belongs to, every one for an administrator, matched on name, description and organization_code. Every kind's matches are scored, 3 when the lower-cased title equals the query's lower-cased words joined by one space, 2 when it starts with them, 1 when every word lies inside it, 0 otherwise, and sorted by score descending, then the smallest position of any word in the title, then title, then id. Several kinds answer the first limit rows of each kind sorted together; one kind answers the page the after cursor names and the cursor of the next page. Every answer carries Cache-Control no-store.
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *           maxLength: 200
 *         description: The text to look for, 2 to 200 characters after trimming
 *       - in: query
 *         name: kinds
 *         schema:
 *           type: string
 *         description: Comma list restricting the kinds searched (host, machine, user, organization); unknown kinds are dropped, none means all four
 *       - in: query
 *         name: scope
 *         schema:
 *           type: string
 *         description: org:<name> keeps the results of that organization, compared case-insensitively; collection:<key> keeps the results of that collection; any other value is no scope
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 5
 *         description: Maximum results per kind
 *       - in: query
 *         name: after
 *         schema:
 *           type: string
 *         description: The next cursor of a previous answer, honoured only while kinds names exactly one kind; a cursor that does not decode or was minted for another query, kind or scope answers the first page
 *       - in: header
 *         name: x-access-token
 *         schema:
 *           type: string
 *         description: The session JWT
 *     responses:
 *       200:
 *         description: The page of results and the count of every kind searched
 *         headers:
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: no-store
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [query, kinds, scope, counts, results, next]
 *               properties:
 *                 query:
 *                   type: string
 *                   description: The trimmed search term
 *                 kinds:
 *                   type: array
 *                   description: The kinds searched, in canonical order
 *                   items:
 *                     type: string
 *                     enum: [host, machine, user, organization]
 *                 scope:
 *                   type: string
 *                   description: The scope applied, empty for none
 *                 counts:
 *                   type: object
 *                   description: Per kind searched, how many results matched after scope and visibility
 *                   additionalProperties:
 *                     type: object
 *                     required: [value, relation]
 *                     properties:
 *                       value:
 *                         type: integer
 *                       relation:
 *                         type: string
 *                         enum: [eq]
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     required: [kind, id, collection, org, name, version, provider, architecture, anchor, source, score, title, subtitle, matched, highlight, facets]
 *                     properties:
 *                       kind:
 *                         type: string
 *                         enum: [host, machine, user, organization]
 *                       id:
 *                         type: string
 *                         description: Natural key unique within the kind - host the registry id; machine the registry id and the machine name joined with a slash; user the username; organization the organization name
 *                       collection:
 *                         type: string
 *                         nullable: true
 *                         description: Always null on this server
 *                       org:
 *                         type: string
 *                         description: The organization name, empty for a host or a machine
 *                       name:
 *                         type: string
 *                         description: The host's entity_name, the machine name, the username, the organization name
 *                       version:
 *                         type: string
 *                         description: Always empty on this server
 *                       provider:
 *                         type: string
 *                         description: Always empty on this server
 *                       architecture:
 *                         type: string
 *                         description: Always empty on this server
 *                       anchor:
 *                         type: string
 *                         description: The registry id of a host or of a machine's host, else empty
 *                       source:
 *                         type: object
 *                         nullable: true
 *                         description: Always null here
 *                       score:
 *                         type: integer
 *                         enum: [0, 1, 2, 3]
 *                       title:
 *                         type: string
 *                         description: The display text of the hit
 *                       subtitle:
 *                         type: string
 *                         description: The chain above the hit as plain text, hostname:port and role for a host, host · hypervisor · status for a machine, organization · role for a user, the description for an organization
 *                       matched:
 *                         type: string
 *                         description: The field that matched
 *                       highlight:
 *                         type: object
 *                         description: Keyed by the matched field, its text and the start and end offsets of each query word's first occurrence in it
 *                         additionalProperties:
 *                           type: object
 *                           required: [text, spans]
 *                           properties:
 *                             text:
 *                               type: string
 *                             spans:
 *                               type: array
 *                               items:
 *                                 type: array
 *                                 items:
 *                                   type: integer
 *                       facets:
 *                         type: object
 *                         description: role and active for a host, status and host for a machine, role for a user, empty for an organization
 *                 next:
 *                   type: string
 *                   nullable: true
 *                   description: The cursor of the next page while kinds names one kind and more results remain, else null
 *       422:
 *         description: The query is shorter than 2 or longer than 200 characters, errors carrying pointer /q and rule minLength or maxLength
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 */
const search = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const term = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (term.length < MIN_QUERY_LENGTH) {
    return refuse(res, req, [
      { pointer: '/q', rule: 'minLength', params: { minLength: MIN_QUERY_LENGTH } },
    ]);
  }
  if (term.length > MAX_QUERY_LENGTH) {
    return refuse(res, req, [
      { pointer: '/q', rule: 'maxLength', params: { maxLength: MAX_QUERY_LENGTH } },
    ]);
  }
  const limit = parseLimit(req.query.limit);
  const kinds = parseKinds(req.query.kinds);
  const scope = parseScope(req.query.scope);

  try {
    const context = await buildContext(req, term);
    const found = await Promise.all(kinds.map(kind => FINDERS[kind](context)));
    const words = wordsOf(term.toLowerCase());
    const compare = compareFor(words);
    const sorted = found.map(rows =>
      rows
        .filter(row => withinScope(row, scope))
        .map(row => ranked(row, words))
        .sort(compare)
    );
    const counts = Object.fromEntries(
      kinds.map((kind, index) => [kind, { value: sorted[index].length, relation: 'eq' }])
    );
    const single = kinds.length === 1;
    const offset = single ? offsetOf(req.query.after, { q: term, kind: kinds[0], scope }) : 0;
    const results = sorted.flatMap(rows => rows.slice(offset, offset + limit)).sort(compare);
    const next =
      single && offset + limit < sorted[0].length
        ? cursorOf({ q: term, kind: kinds[0], scope, offset: offset + limit })
        : null;

    return res.send({ query: term, kinds, scope, counts, results, next });
  } catch (err) {
    log.error.error('Error searching:', err);
    return problem(res, req, { status: 500, type: 'internal' });
  }
};

export { search };
