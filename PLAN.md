# hyperweaver-server: serve startcloud-ui

Pillars: precedence (hyperweaver-agent and BoxVault already serve the shared UI), convergence (one shape across the family), DRY (cp BoxVault's Node files byte for byte, rename only), extend not invent (no new design; a gap is said, not filled). The measure of a change is the fewest edits to the project that keep every feature and meet every objective. One GO per change; the files a change touches are re-read in full before it is applied. Every commit subject is `fix:`.

Sources:

- `G:\Projects\BoxVault\backend\app\` for every Node file copied
- `G:\Projects\hyperweaver-agent\internal\server\` for the family topics and the status feature list
- `G:\Projects\startcloud-ui\docs\guides\universal-*.md` for every wire shape
- `G:\Projects\hyperweaver-server\notifications.md` for the open asks

Rules that bind every change:

- OIDC tokens live in `req.session.oidc` only, never in the JWT; copied BoxVault code that reads `oidc_access_token` from the JWT is redirected to `favorites/helpers.js`'s `extractOidcAccessToken` and `getAuthServerUrl`
- No timer: the agent health poller, BoxVault's health watch interval and the settings restart delay are not carried; the SSE heartbeat and the reconnect backoff stay
- No file over 500 lines after a touch; a split is a mechanical move of whole units
- Swagger stays inline at its handler
- Every tunable is a key of a YAML file under `CONFIG_DIR`

## 1. UI artifact switches to startcloud-ui

- `package.json`: `hyperweaverUiVersion: 0.10.12` becomes `startcloudUiVersion: 0.57.0`; description says STARTcloud UI
- `.github/workflows/prod-build.yml` and `dev-build.yml`: the fetch step reads `startcloudUiVersion` and pulls `https://github.com/STARTcloud/startcloud-ui/releases/download/v${UI_VERSION}/startcloud-ui-${UI_VERSION}.tar.gz` into `ui/`
- `.github/workflows/dependency-bump.yml`: copied from BoxVault, `backend/package.json` becomes `package.json` on both lines
- `.github/workflows/bump-ui-pin.yml`: deleted

## 2. Config engine

- Copy verbatim: `config/config-engine.js`, `utils/validation.js`, `utils/problem.js`, `utils/config-loader.js`, `config/migrations.js` (emptied to `[]`), `scripts/migrate-config.js`
- Copy `config/boxvault.js` as `config/hyperweaver-server.js`: `CONFIG_NAMES = ['app', 'auth', 'db', 'mail']`, `SERVICE_USER = 'hyperweaver-server'`, `PRODUCTION_CONFIG_DIR = process.env.CONFIG_DIR || '/etc/hyperweaver-server'`, `DIRECTORY_POINTERS` `/logging/log_directory` and `/database/storage`, `SSL_POINTERS` `/server/ssl_cert_path` and `/server/ssl_key_path`, `reachable` on `/mail/smtp_host`
- Write `config/schema/{app,auth,db,mail}.schema.yaml` from the current `packaging/config/production-config.yaml` metadata: each `type/description/section/subsection/min/max/enum/required/order` becomes the schema keyword of the same meaning, `value` becomes `default`, secrets gain `writeOnly`, listener and database keys gain `requiresRestart` with a `restartReason`
  - app: `frontend`, `server`, `security`, `logging`, `limits`, `agents` (poll keys removed), `integrations`, `ticket_system`, `branding`
  - auth: `authentication` with `jwt_secret`, local, ldap, `oidc_providers`, external provisioning
  - db: `database`
  - mail: `mail`
- Write `packaging/config/{app,auth,db,mail}.config.yaml` seeds: `schemaVersion: 1`, every required key, placeholder values, no secret
- Write `config/{app,auth,db,mail}.dev.config.yaml` for the development directory
- `utils/config.js` becomes a re-export of `config-loader.js`; every `X?.value` read across `index.js`, `models/index.js`, `utils/loggerCore.js`, `auth/*`, `controllers/*`, `routes/limiters.js`, `utils/sslSetup.js`, `utils/csrfProtection.js` reads the plain value from `loadConfig('<name>')`
- `index.js` boots through `config-loader.js` first, runs in setup mode while `setup.token` exists the way `server.js` does, mounts `configEngineRoutes(app, { admin, setup, actor, user }, exit, UPLOAD_LIMIT)`
- `packaging/DEBIAN/systemd/hyperweaver-server.service`: `Environment=CONFIG_DIR=/etc/hyperweaver-server`, `ConfigurationDirectory=hyperweaver-server`, `ConfigurationDirectoryMode=0750`, `ReadWritePaths` gains `/etc/hyperweaver-server`; `CONFIG_PATH` and `NODE_ENV` lines removed
- `packaging/DEBIAN/postinst`: BoxVault's shape; copies each seed only where absent, creates the empty `setup.token` on fresh install, runs `scripts/migrate-config.js` on upgrade (which flattens the old `{value}` tree into `app.config.yaml`; the migration list carries one entry that moves `authentication` to `auth.config.yaml`, `database` to `db.config.yaml`, `mail` to `mail.config.yaml`); the `.jwt-secret` sed and `chown -R /etc` lines removed
- `utils/auth.js` copied for `ensureJwtSecret`, `getJwtClaimOptions`, `verifySessionToken`
- `package.json` deps add `js-yaml`, `jose`, `i18n`
- `.gitignore`: `/config.yaml` becomes `/config/local/`

## 3. Problem bodies and i18n

- Copy `config/i18n.js`, `config/locales/en.json`, `middleware/errorHandler.js`, `middleware/rateLimiter.js`
- `index.js` mounts the i18n middleware after CORS and the error handler last
- `routes/limiters.js` retires; routes use `apiLimiter`, `authLimiter`, `spaLimiter`
- `app.config.yaml` gains the `rate_limiting` block BoxVault reads

## 4. Session wire

- Copy `utils/jwks.js`, `utils/oidcProviders.js`, `utils/userOrgs.js`, `utils/profile.js`, `middleware/authJwt.js`, `utils/requestAuth.js` (service-account and DPoP branches removed; `x-access-token` session JWT and Authorization Bearer of a trusted issuer), `controllers/auth/signin.js`, `controllers/auth/token.js`, `controllers/auth/backchannelLogout.js`, `controllers/user/getuserprofile.js`, `controllers/user/preferences.js`, `auth/passport.js` (BoxVault's openid-client helpers; replaces `oidcStrategies.js` and `oidcLogout.js`)
- `models/user.model.js` gains `preferred_language`, `preferred_mode`, `preferred_theme`, `preferred_motion`, `name`, `avatar_url`, `sessions_invalid_after` (renamed from `tokens_valid_after` by a migration in `DatabaseMigrations.js`); `models/revoked-session.model.js` copied
- Routes: `POST /api/auth/signin`, `GET /api/auth/oidc/:provider`, `GET /api/auth/oidc/callback` (lands the browser on `/auth/callback?code=` with a single-use code), `POST /api/auth/oidc/exchange`, `POST /api/auth/refresh-token`, `POST /api/auth/oidc/logout`, `POST /api/auth/oidc/backchannel-logout`, `GET /api/auth/oidc/issuers`, `GET /api/user`, `PATCH /api/user/preferences`, `PATCH /api/user`; `POST /api/auth/login`, `GET /api/auth/verify`, `GET /api/auth/profile`, the `#token=` fragment and `/ui/login` redirects retire
- `auth/auth.js` `authenticate` reads `x-access-token` first through `requestAuth`, Bearer second; `optionalAuth` likewise
- `auth/oidcTokenRefresh.js` stays; `auth/externalUser.js` stays; `auth/ldapStrategy.js` stays, its login route answering the signin shape

## 5. Status

- `controllers/StatusController.js` rewritten to BoxVault's `STATUS` constant shape: `role 'hyperweaver-server'`, `version`, `brand { name: 'Hyperweaver', logo_url: '/brand/hyperweaver/mark.svg', repo: 'https://github.com/Makr91/hyperweaver-server' }`, `auth ['backend']`, `collections []`, `config` from `CONFIG_NAMES`, `features ['local-accounts', 'setup', 'admin', 'update', 'org-console', 'invitations', 'favorites', 'notifications', 'inbox', 'health', 'footer', 'sidebar', 'search', 'events', 'rules', 'hosts', 'certs', 'tools']` with `local-accounts` dropped while `local_enabled` is false, `events { path: '/api/events', topics }`, `search { path: '/api/search', kinds: ['host', 'machine', 'user', 'organization'] }`, `links { docs: '/docs', contact: '', api: '/api-docs', community: [] }`, `ticket null`, `datacenter_label` under the existing toggle
- `routes/status.routes.js` copied

## 6. Events

- Copy `utils/events.js` with `TOPICS = ['session', 'notifications', 'health', 'profile', 'tasks', 'hosts', 'monitoring', 'sessions']`, `routes/events.routes.js` with `authenticate` in place of `authJwt`, `utils/notificationRelay.js` with its token source redirected
- New `utils/agentRelay.js`: for each registered agent, while any browser subscribes to a family topic, one upstream `GET {agent}/api/events?topics=tasks,hosts,monitoring,sessions,health` with the agent's key, each frame re-broadcast through `broadcast(topic, event, { ...data, agent_id })`, `health` re-broadcast as the agent's health keyed by `agent_id`, `monitoring` opened only while a browser asked for that agent's; reconnect with `Last-Event-ID` on jittered backoff; closed when the last subscriber leaves
- `registry.js` and `manage.js` publish `servers-updated` after add, remove, update and after a `capabilities` change
- `utils/agentHealthPoller.js` deleted; `refreshStatus` runs on registration and on each upstream `ready`
- `controllers/auth/backchannelLogout.js` and logout publish `session-terminated`; `preferences.js` publishes `profile-updated`

## 7. Health, rules, client errors, ticket

- `GET /api/health` answers `{ status, timestamp, services: { database, agents }, supported_languages, default_language, frontend_logging }`, `agents` the worst of the registry's last-seen states; published on the `health` topic when it changes
- Copy `controllers/rules.controller.js`, `utils/rules.js` with `FORMS = ['login', 'register', 'password', 'email', 'displayName', 'profile', 'invitation', 'organization']`, `rules/defs.json` and those eight rule files, `routes/rules.routes.js`, `middleware/validate.js`
- Copy `routes/client_errors.routes.js`, `controllers/client_errors/report.js`
- `controllers/ConfigController.js` reads the plain `app` file; `routes/config.routes.js` copied without gravatar

## 8. Agent path prefix

- `controllers/servers/proxy.js`: the target is `${serverUrl}/api/${path}` unless `path` already starts with `api/`
- `models/serverRequests.js`: `fetchStatus`, `probeStatus`, `testServerWithApiKey`, `bootstrapApiKey`, `/stats` and every `makeRequest` call under `/api/`
- `utils/wsProxy.js`: every backend URL under `/api/`
- `refreshStatus` stores the agent's whole status payload as `capabilities`
- `utils/orgAccess.js` route allowlist entries keep their agent-relative paths

## 9. Favorites, notifications, search

- Copy `routes/favorites.routes.js`, `controllers/favorites/user.js`, `routes/notification.routes.js`, `controllers/notification.controller.js` (the push, subscription and test routes answer 503 not-configured the way `notifications.go` does; `utils/notifyHub.js` not copied)
- `controllers/favorites/get.js`, `save.js`, `enriched.js` and the `/api/favorites*`, `/api/userinfo/favorites` routes retire; `claims.js` stays
- Copy `controllers/search/search.js`, `scope.js`; new `controllers/search/finders.js` with `host` over the registry rows, `machine` over each visible agent's `GET /api/machines`, `user` and `organization` over the local tables; `routes/search.routes.js`; `GET /opensearch.xml` from BoxVault's `opensearch.controller.js`

## 10. UI serving

- Copy `middleware/uiIndex.js` without the sites stamping
- `index.js`: `express.static('ui', { index: false })` at `/`, `GET /index.html` to `uiIndex(404)`, `GET /manifest.json`, `GET /opensearch.xml`, the `*splat` catch-all to `uiIndex()`; the `/ui` mount and `/ui/*splat` fallback retire; `/docs` 503 stays; `/agent/api-docs` relay stays
- CORS: origins `frontend_url`, `security.cors.whitelist`, `https://provisioner-catalog.startcloud.com`; headers `x-access-token`, `Authorization`, `Origin`, `Content-Type`, `Accept`; `exposedHeaders ['X-Refreshed-Token']`; `GET /api/status` public with `Vary: Origin`

## 11. Settings surface retires

- `controllers/SettingsController.js`, `controllers/settings/configWriter.js`, `controllers/CollectionController.js`, `controllers/BackupController.js`, `controllers/SslController.js` and their `/api/settings*` routes deleted; the engine's `/api/config/*` and `/api/setup*` routes serve the admin and setup pages; the SSL upload is the `action: upload` on the two SSL leaves of `app.schema.yaml`
- `routes/index.js` split mechanically into `routes/auth.routes.js`, `routes/user.routes.js`, `routes/servers.routes.js`, `routes/organizations.routes.js`, `routes/admin.routes.js`, each mounted at `/api` in `index.js`

## 12. Packaging and docs

- `prod-build.yml` and `dev-build.yml`: copy `config/schema`, `packaging/config/*.yaml` to `/opt/hyperweaver-server/config-templates/`, `scripts/`; the `production-config.yaml` copy line removed
- `packaging/DEBIAN/man/hyperweaver-server.8` and `hyperweaver-server.yaml.5`, `README.md`: name `CONFIG_DIR`, the four files, `/api/config/<name>`, `setup.token`, `hwa://open`
- `release-please-config.json` `extra-files` drops `packaging/config/production-config.yaml`; `scripts/sync-versions.js` drops the yaml regex blocks
- `packaging/config/production-config.yaml` deleted

## 13. Swagger

- `config/swagger.js`: security schemes `sessionAuth` apiKey `x-access-token` and `bearerAuth`; `Problem` schema added; `User` schema matches `GET /api/user`

## 14. Brief

- `notifications.md`: every section the above closes is deleted; sections 7b, 7c, 7d, 8c, 8d and 8g stay until their agent surfaces land

## Verification after every change

- `npm run format && npm run lint:fix`
- `npm start` against a development `config/*.dev.config.yaml`, `GET /api/status`, `GET /api/health`, `GET /api/rules`, a signin, `GET /api/user`, `GET /api/events?topics=session,hosts`
