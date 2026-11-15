# hyperweaver-server: serve startcloud-ui the way BoxVault does

The server takes the shape the shared UI reads. Where the two differ, the server changes. Every feature the server has stays.

Method: a file BoxVault has is copied from `../BoxVault/backend/app/` and then edited in place for names, imports and guards; nothing is written anew where a BoxVault file exists. Each copy is diffed against its source.

Rules that bind every step:

- No migration, shim or backwards-compatible code
- No timer; the SSE heartbeat and the reconnect backoff stay
- No comment is added to any file
- Names are `snake_case`, except where a library requires otherwise
- No file over 500 lines after a touch
- Swagger stays inline at its handler
- Every tunable is a key of a YAML file under `CONFIG_DIR`
- Every commit subject is `fix:`

A section is deleted when its change is committed.

## 1. Packages

- `package.json` gains `sequelize`, `sqlite3`, `mysql2`, `bcryptjs`, `connect-session-sequelize`, `lusca`, `semver` at BoxVault's versions
- `@sequelize/*`, `bcrypt`, `ldapts`, `passport-jwt`, `passport-local`, `passport-oauth2` leave with the code that imports them, in section 7

## 2. Models

- Copy `models/index.js`, `schema.js`, `fold-case.js`, `user.model.js`, `role.model.js`, `organizations.model.js`, `user-org.model.js`, `invitation.model.js`, `credential.model.js`, `request.model.js`, `revoked-session.model.js`, `scim-group.model.js`, `service_account.model.js`; the box, ISO and download associations are trimmed
- Copy `utils/wire.js`
- `models/server.model.js`, `serverOrg.model.js`, `machineOrg.model.js` and `serverRequests.js` move to the same `(sequelize, Sequelize)` shape, their columns and methods unchanged
- `users` keeps `default_domain`

## 3. Config

- Copy `config/schema/auth.schema.yaml`, `db.schema.yaml` and their seeds under `packaging/config/` and `config/*.dev.config.yaml`, with `utils/config-loader.js`; the keys become `auth.jwt`, `auth.local`, `auth.oidc`, `auth.external`, `database_type`, `sql`, `mysql_pool`
- The password minimum is 15 in the schema and both seeds
- The LDAP keys are absent

## 4. Auth and utils

- Copy `auth/passport.js`, `auth/external-user-handler.js`, `utils/externalOrgs.js`, `externalInvites.js`, `userOrgs.js`, `requestAuth.js` whole, `serviceAccountAuth.js`, `oidcRefresh.js`, `orgMembership.js`, `identity.js`, `jwtUser.js`, `reservedSegments.js`, `auth.js`, `middleware/authJwt.js`, `verifyOrgAccess.js`, `verifySignUp.js`, `oidcTokenRefresh.js`, `scimAuth.js`, `rules/password-blocklist.json`
- The session JWT carries `id_token`, `oidc_access_token`, `oidc_refresh_token` and `oidc_expires_at`
- `orgMembership.js` and `verifyOrgAccess.js` lose their box, ISO and download rules

## 5. Controllers and routes

- Copy `controllers/auth/*`, `user/*`, `organization/*`, `request/*`, `service_account/*`, `scim/*`, `mail/*`, `config/gravatar.js`, `app/updates.js` and `routes/auth.routes.js`, `user.routes.js`, `organization.routes.js`, `request.routes.js`, `service_account.routes.js`, `scim.routes.js`, `mail.routes.js`, `system.routes.js`; the box, ISO, download and storage parts are trimmed
- The rule files the copied routes validate against are copied with them

## 6. Behaviours this server keeps as its own routes

- Password change that checks the current password
- Self-delete that checks the password and the typed confirmation
- The user list of one organization for its admins, with the inactive filter
- Invitation resend by id with its own expiry
- Organization stats
- Organization name check
- User deactivate and reactivate, with the own-account guard

## 7. Removal

- `controllers/RegistrationController.js`, `AccountController.js`, `AuthController.js`, `OidcController.js`, `LdapController.js`, `UserManagementController.js`, `OrganizationController.js`, `InvitationController.js`, `MailController.js`, `controllers/users/*`, `organizations/*`, `invitations/*`
- `auth/oidcStrategies.js`, `oidcLogout.js`, `externalUser.js`, `ldapStrategy.js`, `ldapClient.js`, `auth.js`
- `models/organization.model.js`, `revokedSession.model.js`, `config/DatabaseMigrations.js`, `utils/SequelizeSessionStore.js`
- `routes/admin.routes.js`, `organizations.routes.js`, `gravatar.js`
- The packages section 1 names

## 8. Rewiring

- `index.js` follows the order of BoxVault's `server.js`: the database opens after setup, `upgradeSchema` runs, the roles are seeded; the WebSocket upgrade, the agent docs relay and `force_secure` stay
- `utils/orgAccess.js` and `orgVisibility.js` read `user_organizations`
- `controllers/StatusController.js`, `HealthController.js`, `search/finders.js`, `search/scope.js`, `OrgAccessController.js`, `servers/*`, `utils/agentRelay.js`, `wsProxy.js` read the new models and gates

## 9. What the shared UI reads

- `GET /api/user` and the sign-in answer carry `role`: `super-admin` for a global admin, `admin` for an owner or admin of an organization, `user` otherwise
- `roles` carries `ROLE_ADMIN` for a global admin
- The proxy target keeps one `api/` prefix when the path already starts with it
- `GET /api/servers?includeApiKeys=true` answers each key to a global admin
- `GET /api/config/ticket` is answered before the engine's `/config/:name`
- `GET /api/status` answers a sending origin

## 10. Packaging

- `packaging/DEBIAN/systemd/hyperweaver-server-update.path`, `hyperweaver-server-update.service` and `packaging/scripts/certbot-deploy-hook.sh` are copied from BoxVault's and renamed to `hyperweaver-server`
- `routes/system.routes.js` mounts `/api/app/updates/check` and `/api/app/updates/apply`
- `config/app.dev.config.yaml` gains the `updates` block
- `config/locales/en.json` names Hyperweaver wherever it names BoxVault

## 11. The brief

- Every open section of `notifications.md`, in its own order

## 12. Proof

- `npm run format && npm run lint:fix`
- `npm start` against `config/*.dev.config.yaml`, then every page of the pinned UI build against a live agent

## 13. Other repositories, by brief

- startcloud-ui: `FOLLOWUPS/universal-access.md` as a contract, the controls for section 6
- authorization-server, BoxVault, hyperweaver-agent, zoneweaver-agent: the role and permission form of that contract
