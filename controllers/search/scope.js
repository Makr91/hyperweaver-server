import db from '../../models/index.js';
import { getUserOrgAccess } from '../../utils/orgAccess.js';
import { containing } from '../../utils/like.js';

const { Sequelize } = db;
const { Op } = Sequelize;

const KINDS = ['host', 'machine', 'user', 'organization'];

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;
const SCOPE = /^(?<field>org|collection):(?<value>.+)$/su;

/**
 * Parse the per-kind limit: default 5, at most 50.
 * @param {*} value - The raw limit query value
 * @returns {number} The limit to apply per kind
 */
const parseLimit = value => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
};

/**
 * Parse the optional comma list of kinds, keeping only known kinds in the
 * canonical order; no restriction means every kind.
 * @param {*} value - The raw kinds query value
 * @returns {string[]} The kinds to search
 */
const parseKinds = value => {
  if (typeof value !== 'string' || value.trim() === '') {
    return [...KINDS];
  }
  const wanted = new Set(value.split(',').map(kind => kind.trim()));
  const kinds = KINDS.filter(kind => wanted.has(kind));
  return kinds.length > 0 ? kinds : [...KINDS];
};

/**
 * Parse the optional scope: `org:<name>` or `collection:<key>` as sent,
 * anything else as no scope.
 * @param {*} value - The raw scope query value
 * @returns {string} The scope, empty for none
 */
const parseScope = value => (typeof value === 'string' && SCOPE.test(value) ? value : '');

/**
 * Whether a result lies within a scope: its organization equal to the
 * name of an `org:` scope, compared case-insensitively, or its collection
 * equal to the key of a `collection:` scope; every result lies within no
 * scope.
 * @param {{org: string, collection: string|null}} result - The result row
 * @param {string} scope - From parseScope
 * @returns {boolean}
 */
const withinScope = (result, scope) => {
  const match = SCOPE.exec(scope);
  if (!match) {
    return true;
  }
  const { field, value } = match.groups;
  if (field === 'org') {
    return result.org.toLowerCase() === value.toLowerCase();
  }
  return result.collection === value;
};

/**
 * The cursor of the page that starts at an offset of one kind's sorted
 * results: the base64url of `{ q, kind, scope, offset }`.
 * @param {{q: string, kind: string, scope: string, offset: number}} state - The page
 * @returns {string} The opaque cursor
 */
const cursorOf = state => Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');

/**
 * The offset a cursor names when it was minted for the same query, kind
 * and scope; zero, the first page, for no cursor, one that does not decode
 * or one minted for another search.
 * @param {*} after - The raw after query value
 * @param {{q: string, kind: string, scope: string}} search - The search being answered
 * @returns {number} The offset of the page
 */
const offsetOf = (after, { q, kind, scope }) => {
  if (typeof after !== 'string' || after === '') {
    return 0;
  }
  let state;
  try {
    state = JSON.parse(Buffer.from(after, 'base64url').toString('utf8'));
  } catch {
    return 0;
  }
  const matches =
    state !== null &&
    typeof state === 'object' &&
    state.q === q &&
    state.kind === kind &&
    state.scope === scope &&
    Number.isInteger(state.offset) &&
    state.offset > 0;
  return matches ? state.offset : 0;
};

/**
 * One LIKE clause per column.
 * @param {string[]} columns - Attribute names of the main model
 * @param {Object} pattern - The LIKE value, from utils/like.js
 * @returns {Object[]} Clauses to place under Op.or
 */
const likeClauses = (columns, pattern) =>
  columns.map(column => ({ [column]: { [Op.like]: pattern } }));

/**
 * The words of a search term, split on whitespace.
 * @param {string} term - The trimmed search term
 * @returns {string[]} The words, at least one
 */
const wordsOf = term => term.split(/\s+/).filter(Boolean);

/**
 * The spellings one word is looked for under: the word itself and, when it
 * carries dots, the word with its dots dropped, so 14.5.1 also finds 1451.
 * @param {string} word - One word of the term
 * @returns {string[]} The spellings, lower-cased
 */
const spellingsOf = word => {
  const lower = word.toLowerCase();
  const compact = lower.replace(/\./g, '');
  return compact && compact !== lower ? [lower, compact] : [lower];
};

/**
 * The tokens of a search term: every word with its spellings and the LIKE
 * values of those spellings, each matching the spelling literally on every
 * database.
 * @param {string} term - The trimmed search term
 * @returns {Array<{spellings: string[], patterns: Object[]}>} One token per word
 */
const tokensOf = term =>
  wordsOf(term).map(word => {
    const spellings = spellingsOf(word);
    return { spellings, patterns: spellings.map(spelling => containing(spelling)) };
  });

/**
 * The where clause of a token search: every token must match at least one
 * of the columns under one of its spellings; `extra` adds clauses per
 * pattern beyond the columns, the metadata column read as text for one.
 * @param {string[]} columns - Attribute names, `$include.column$` names included
 * @param {Array<{patterns: Object[]}>} tokens - From tokensOf
 * @param {Function} [extra] - Pattern to extra clauses
 * @returns {Object} The where clause
 */
const tokenClauses = (columns, tokens, extra = () => []) => ({
  [Op.and]: tokens.map(({ patterns }) => ({
    [Op.or]: patterns.flatMap(pattern => [...likeClauses(columns, pattern), ...extra(pattern)]),
  })),
});

/**
 * The first field of a chain that answers the search, or null when a token
 * appears in none of them: every token must be found, under one of its
 * spellings, in at least one entry; the answer names the first entry the
 * first token is found in, with its text as the row holds it.
 * @param {Array<[string, *]>} entries - Field name and text, in match priority order
 * @param {Array<{spellings: string[]}>} tokens - From tokensOf
 * @returns {{field: string, text: string}|null} The matched field and its text
 */
const matchedChain = (entries, tokens) => {
  const texts = entries
    .filter(([, text]) => typeof text === 'string')
    .map(([field, text]) => ({ field, text, lower: text.toLowerCase() }));
  const holder = token =>
    texts.find(({ lower }) => token.spellings.some(spelling => lower.includes(spelling)));
  if (!tokens.every(token => holder(token))) {
    return null;
  }
  const { field, text } = holder(tokens[0]);
  return { field, text };
};

/**
 * Resolve everything the finders need for one request: the term, its
 * tokens, the person's organization access and whether they bypass it.
 * @param {import('express').Request} req - The request
 * @param {string} term - The trimmed search term
 * @returns {Promise<Object>} The search context
 */
const buildContext = async (req, term) => {
  const access = await getUserOrgAccess(req);
  return {
    req,
    term,
    tokens: tokensOf(term),
    access,
    isAdmin: access.bypass || req.user?.role === 'admin',
  };
};

export {
  KINDS,
  MIN_QUERY_LENGTH,
  MAX_QUERY_LENGTH,
  parseLimit,
  parseKinds,
  parseScope,
  withinScope,
  cursorOf,
  offsetOf,
  likeClauses,
  wordsOf,
  tokensOf,
  tokenClauses,
  matchedChain,
  buildContext,
};
