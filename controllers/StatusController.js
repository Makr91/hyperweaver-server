/**
 * @fileoverview Server status / identity controller
 * @description Public dual-mode probe (dual-mode plan §3.2). The SPA hits
 * GET /api/status against its origin to pin Axis 1 (serving mode). For the
 * Hyperweaver Server this reports role=server plus the enabled auth methods,
 * pre-auth — the login screen depends on it.
 */

import { readFileSync } from 'fs';
import { CONFIG_NAMES, loadConfig } from '../utils/config-loader.js';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const EVENT_TOPICS = [
  'session',
  'notifications',
  'health',
  'profile',
  'tasks',
  'hosts',
  'monitoring',
  'sessions',
];

const STATUS = {
  role: 'hyperweaver-server',
  version,
  brand: {
    name: 'Hyperweaver',
    logo_url: '/brand/hyperweaver/mark.svg',
    repo: 'https://github.com/Makr91/hyperweaver-server',
    changelog: 'https://github.com/Makr91/hyperweaver-server/releases',
  },
  auth: ['backend'],
  collections: [],
  config: CONFIG_NAMES,
  events: { path: '/api/events', topics: EVENT_TOPICS },
  search: { path: '/api/search', kinds: ['host', 'machine', 'user', 'organization'] },
  links: { docs: '/docs', contact: '', api: '/api-docs', community: [] },
  ticket: null,
};

const FEATURES = [
  'setup',
  'admin',
  'update',
  'org-console',
  'invitations',
  'favorites',
  'notifications',
  'inbox',
  'health',
  'footer',
  'sidebar',
  'search',
  'events',
  'rules',
  'hosts',
  'certs',
  'tools',
];

/**
 * The feature tokens this host lists: the fixed set, `local-accounts`
 * while local sign-in is on.
 * @param {Object} authentication - The auth file's `authentication` section
 * @returns {string[]} The tokens
 */
const featuresOf = authentication =>
  authentication.local_enabled === false ? FEATURES : ['local-accounts', ...FEATURES];

/**
 * Server status controller
 */
class StatusController {
  /**
   * @swagger
   * /api/status:
   *   get:
   *     summary: The host's identity, auth method and feature tokens (public)
   *     description: Answered before login. role is hyperweaver-server, the aggregating host whose agents the shared UI addresses as /api/agents/{id}/{path}; auth is backend, the app's own session; features gates every surface the UI draws, local-accounts present while local sign-in is on; config names the configuration files served at /api/config/<name>; events names the one stream and every topic it carries; search names the search route and its kinds; datacenter_label is the name of the hosts tree's root while branding.public_datacenter_label is on.
   *     tags: [System]
   *     responses:
   *       200:
   *         description: The status payload
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [role, version, brand, auth, features, config, events, search, links, ticket]
   *               properties:
   *                 role:
   *                   type: string
   *                   example: hyperweaver-server
   *                 version:
   *                   type: string
   *                   example: 0.9.9
   *                 brand:
   *                   type: object
   *                   properties:
   *                     name: { type: string, example: Hyperweaver }
   *                     logo_url: { type: string, example: /brand/hyperweaver/mark.svg }
   *                     repo: { type: string }
   *                     changelog: { type: string }
   *                 auth:
   *                   type: array
   *                   items: { type: string }
   *                   example: [backend]
   *                 collections:
   *                   type: array
   *                   items: { type: string }
   *                   example: []
   *                 features:
   *                   type: array
   *                   items: { type: string }
   *                 config:
   *                   type: array
   *                   items: { type: string }
   *                   example: [app, auth, db, mail]
   *                 events:
   *                   type: object
   *                   properties:
   *                     path: { type: string, example: /api/events }
   *                     topics:
   *                       type: array
   *                       items: { type: string }
   *                 search:
   *                   type: object
   *                   properties:
   *                     path: { type: string, example: /api/search }
   *                     kinds:
   *                       type: array
   *                       items: { type: string }
   *                 links:
   *                   type: object
   *                   properties:
   *                     docs: { type: string }
   *                     contact: { type: string }
   *                     api: { type: string }
   *                     community:
   *                       type: array
   *                       items: { type: object }
   *                 ticket:
   *                   type: object
   *                   nullable: true
   *                 datacenter_label:
   *                   type: string
   */
  static getServerStatus(req, res) {
    void req;
    const { authentication } = loadConfig('auth');
    const { branding } = loadConfig('app');
    const payload = { ...STATUS, features: featuresOf(authentication) };
    if (branding.public_datacenter_label) {
      payload.datacenter_label = branding.datacenter_label;
    }
    res.json(payload);
  }
}

export default StatusController;
