## Note to Other AI's that Write to this from Mark Himself

This repo is ONLY going to be outhced ONCE hyperweaver-agent is fully completed, THEN we will be updating hyperweaver-server, and THEN zoneweaver-agent, so things here WILL accrue, however you can put messages here and asl ong as your are detailed and do the work on your end, this repo WILL implmente what you asked for.

If your asks contradicts a already written task, you may append it with a date and a reason. DO HOLD UP WORK BASED ON HYPERWEAVER-SERVER not implemetning anyting

# Notifications from the STARTcloud UI estate

Estate-wide tracking is `../authorization-server-private/priorities.yaml`,
read-only from this repo. The contracts are
`../startcloud-ui/docs/guides/universal-*.md`,
`../startcloud-ui/docs/guides/preferences-and-branding.md` and
`../startcloud-ui/docs/guides/UI-GROWTH-GUIDE.md`; the copies under
`../authorization-server-private/docs/guides/` are pointer stubs and are
never cited. The governing rules and the D-ledger for the hyperweaver
family are `../hyperweaver-docs/docs/roadmap.md`. Every item below is open
work for this repository; an item is deleted when it is done.
Read every file named below in full before acting on any of it.

## 0. 2026-09-27: hyperweaver-ui merges into startcloud-ui, and this repository moves first

Why, in Mark's words: "its a new merge project, its merging hyperweaver-ui into startcloud-ui, and I want this for alot of reasons"; the Direct-versus-Aggregated mode "is more of a add these options to the system" and "is the first thing we should grow"; the polling "needs to be done for correctness", and the backends update before the port so the UI is ported once and never patched twice.

hyperweaver-ui does not change again. Its pages become features of startcloud-ui reading the status payload and the one event stream, so the port reads the shape below from its first day. Sections 7 and 9 already list every gap; this section names the order and the two things the port cannot start without.

1. `GET /api/status` in the shared shape now, `controllers/StatusController.js:72-87`: `role` is the package name, `hyperweaver-server`, the way BoxVault answers `boxvault` (the shared UI builds the update command from it); `version`; `brand { name, logo_url: "/brand/hyperweaver/mark.svg", repo }`; `auth` in the estate vocabulary, `["backend"]`; `features` with `footer`, `health` once `/api/health` answers the contract shape, and `events` once the stream exists; `links { docs, contact }`; `ticket` or `null`; `config` (the file names of section 7 as they land). The shared UI tells Aggregated from Direct by `role` alone and addresses an agent as `/api/agents/{id}/{path}` on this role, so `controllers/servers/proxy.js:332-391` stays the wire. Deciding source: `universal-navbar.md:578-688`; `universal-events.md:68-88`.
2. `GET /api/events`, the `session` topic first, then the topics the ported pages read instead of polling: the tasks pane (`hyperweaver-ui/src/contexts/FooterContext.jsx:173-206` polls every agent every second), the sidebar tree's machine lists and dots (`SidebarTree.jsx:104-142`, every 10 s), the registry's capabilities (`utils/agentHealthPoller.js:53-69`, every 60 s). In Aggregated mode the browser opens one stream to this origin, so the agents' events reach the page through this stream, keyed by agent id. The names are registered, in Mark's words "if we need event stream then create a fucking event stream", "just do it and make it right": `universal-events.md`, Hyperweaver family, fixes topic `tasks` with the event `task-updated`, one task row as `GET /api/tasks` answers it, and topic `hosts` with `stats-updated`, the `GET /api/stats` shape of one agent, and `servers-updated`, `{}`, this server's own event, sent when a registry row is added, removed or its `capabilities` change; neither topic has a snapshot. This server adds `agent_id`, the registry id, to the data of every agent's event it relays, and the shared UI already reads all three. The wire can be watched before it is built here: `npm run mock` in `../startcloud-ui` (`scripts/mock-hyperweaver.js`) streams it. Deciding source: `universal-events.md:40-64,171-271`.
3. The `/api` route move of section 4, unchanged in order.
4. `features` lists `hosts` once items 1 and 3 are in: the token the shared UI's hosts feature is gated by (`universal-navbar.md`, the feature-token table), its pages reading `GET /api/servers` here and `/api/agents/{id}/stats` per agent.
5. The footer's pane, written in `universal-navbar.md` under Footer status, The pane, and drawn live in `../startcloud-ui/docs/guides/universal-footer.html`. Why, in Mark's words: the two footers "converge into one footer", "the existing footer system we have, plus sub configs like we do for health, ie tasks, host-shell or footer shell", the shell "a dynamic thing to be more than just the host shell or host terminal like it is in hyperweaver currently". This server lists none of the pane's tokens in its own `features`: the shared UI reads `tasks` and `host-terminal` from the registry row's `capabilities` of the host the route names, the footer's one Shell behind `host-terminal` and a terminal per machine later work, so `GET /api/servers` keeps answering each row's `capabilities` as the agent reported them. What it calls through this server: `/api/agents/{id}/tasks`, `/tasks/{taskId}`, `/tasks/{taskId}/output`, `/term/start`, `/term/sessions/{sessionId}/stop` and `/ws-ticket` through `controllers/servers/proxy.js:332-391`, and the upgrades `/api/agents/{id}/term/{sessionId}` and `/tasks/{taskId}/stream` through `utils/wsProxy.js:250-341`, both staying the wire; once the agents move under `/api` (their item 3) the forwarded path gains that prefix on the agent's side, `models/serverRequests.js:183` for a standard request, `controllers/servers/proxy.js:42` for a streamed one and `utils/wsProxy.js:85` for an upgrade being where it is built. With no host in the route the pane draws every host's tasks under a Host column, one `/api/agents/{id}/tasks` per host that lists `tasks`, read once and never on a timer; what is owed within item 2 is the agents' task events on this server's one stream, keyed by agent id, so that list stays current without a second request.
6. The agent role guard. `controllers/servers/proxy.js:344`, `utils/wsProxy.js:23`, `utils/agentHealthPoller.js:41` and `index.js:300` admit a registry row only while its `capabilities.role` is `agent`. The agents' item 1 changes that member to the package name, `hyperweaver-agent` or `zoneweaver-agent`, so from the release an agent ships it this server answers 409 on every request proxied to that agent and drops every WebSocket upgrade to it. The guard admits the two agent package names, and this change and the agents' item 1 ship together.
7. This server's own reads of an agent's root, which the agents' `/api` move (their item 3) reaches beside the proxied paths of item 5: `/status` in `fetchStatus` and `probeStatus` (`models/serverRequests.js:119,296`), which both agents already answer at `/api/status` too; `/stats` in `testServerWithApiKey` (`models/serverRequests.js:264`); `/api-keys/bootstrap` in `bootstrapApiKey` (`models/serverRequests.js:325`); each gains the `/api` prefix in the release the agents move. `/api-docs/swagger.json` (`index.js:304`) follows wherever the agents keep `/api-docs`; hyperweaver-agent keeps it at the root (its section 4, step 1).
8. Organizations, BoxVault's way. Why, in Mark's words: "I think the oidc strategies was an old way of mapping things, BoxVault has had the most success recently and I think that the server should match its styling". Today `auth/oidcStrategies.js:101-110` keeps the identity provider's `organizations` claim in the session as it arrived, `auth/externalUser.js:20-129` gives a person one local organization found by invitation or email domain, and `utils/orgAccess.js:38-71` reads the session's list for a federated sign-in and the one local organization otherwise. BoxVault mirrors: every organization of the claim becomes a row of its own organizations table keyed by the identity provider's uuid, a person holds many memberships with one primary, and the mirror is synced exactly at every sign-in, added, updated and removed, the rules in one module its SCIM receiver shares (`../BoxVault/backend/app/auth/external-user-handler.js:66-174`, `../BoxVault/backend/app/utils/externalOrgs.js:138-194`, `../BoxVault/backend/app/utils/userOrgs.js`). Required change: the same machinery here, `org_uuid` the identity provider's uuid verbatim for a mirrored organization as `models/organization.model.js:43-53` already says, a membership table in place of the one `organization_id`, and `utils/orgAccess.js` reading the rows. The file is copied from BoxVault and adapted, not written.
9. The profile's organizations in the identity provider's shape. Why, in Mark's words: "let's make hyperweaver-server match the identity provider". `GET /api/user`, owed in section 7 under Session wire shape, answers `organizations` as the identity provider answers them on the same route: `[{ uuid, name, roles: [], primary, personal, logo_url, email_hash }]`, `roles` uppercase (`OWNER`, `ADMIN`, `MEMBER`, `GUEST`), for a local sign-in and a federated one alike, a local organization's `uuid` the `org_uuid` minted at its creation (`models/organization.model.js:115-119`). The shared UI keys the active organization by that `uuid`, because the authorization server rules that "resource servers key on `uuid`" and a name can be renamed (`../authorization-server-private/docs/features/organizations.md`, The identity model). Deciding source: `universal-identity.md`, Group 4, What the UI backend answers for the signed-in pages; `universal-session.md`, Backend session provider.
10. `org_uuids` stays on the rows. The shared UI's organization switcher narrows the hosts and the machines a person sees to the organization they picked, or shows every one under "All organizations", from the `org_uuids` of `GET /api/servers` and of a proxied `GET machines` (`utils/orgVisibility.js:30-112`); a row without the member, or with an empty list, shows under every choice. The choice is a view and never a gate: `utils/orgAccess.js:332-388` and `utils/orgVisibility.js` stay the enforcement on every request, by the union of the person's organizations, and nothing the browser sends narrows or widens it.
11. `GET /api/config/ticket` in plain values. `controllers/ConfigController.js:35-50` answers `config.ticket_system` as the file holds it, every leaf a node around `value`, and no `fallback_customer_id`. The shared UI reads the section's leaves plain, `enabled`, `base_url`, `req_type`, `fallback_customer_id` and `context` (`../startcloud-ui/src/hooks/useTicketUrl.js:14-25`), so against this answer `enabled` is an object, which reads as on whatever its value, and `base_url` an object where the link needs a string. Required change: `{ "ticket_system": { "enabled", "base_url", "req_type", "fallback_customer_id", "context" } }` with plain values, which the plain file of section 7 gives for nothing, or `ticket` in `/api/status` and no route. Deciding source: `universal-navbar.md`, the status payload's `ticket` row and Help ticket.
12. The registry row's names. `GET /api/servers` answers the model's own `snake_case` attributes (`models/server.model.js:36-88`, `utils/orgVisibility.js:66-72`), and the shared UI reads `entity_name` from it. Two answers still hand-build `entityName`: `POST /api/servers` (`controllers/servers/registry.js:118-125`) and `PATCH /api/servers/{id}` (`controllers/servers/manage.js:206-213`); they are renamed with the body members section 5 already asks for.
13. `links.api` in `/api/status`. Why, in Mark's words: "the api docs can be the startcloud-ui way", and of how the reference is drawn: "if we get the API swagger into the react app itself, then as a page section with no navigation if possible, but if we don't have that, then I guess new tab". The shared UI's account menu draws an API reference row from `links.api` of the status payload, after Docs, and draws none while the member is empty or absent (`../startcloud-ui/src/components/layout/AppShell.jsx:345-352`). This server serves its own reference at `/api-docs` with the document at `/api-docs/swagger.json`, and the reference of one agent at `/agent/api-docs?server={id}` with its document at `/agent/api-docs/swagger.json` (section 7, Reserved first segments). Required change: `links` in the status payload of item 1 carries `api`, the path this server's own reference answers at, `/api-docs` today and wherever section 7 leaves it afterwards, empty or absent while the reference is off; both documents stay readable at the reference's path plus `/swagger.json`, which is what a reference drawn inside the shared UI reads. The per-agent reference stays the wire it is: hyperweaver-ui drew two rows on this role, the server's and the selected host's (`../hyperweaver-ui/src/components/SidebarFooter.jsx:310-343`), and the second is the shared UI's own work, built from the registry id. Deciding source: `universal-navbar.md`, the status payload's `links` row.

Deletion of this section is the confirmation, the way every other item here works.

## 1. The rule

Why: a UI backend that keeps its UI under a prefix breaks every deep link,
badge and notification the estate shares.

The SPA owns `/`. Everything a program calls lives under `/api`, plus the
paths a client protocol dictates (Vagrant's box shapes on BoxVault, the
catalog's `/catalog.json`). A machine and a browser asking for the same
root URL are told apart by the client's own signal, `Accept` or user
agent, the way Vagrant Cloud answers `/myuser/test` with JSON for `vagrant
box add` and a page for a person. No UI backend redirects, and no UI
backend puts a reverse proxy in front of itself to do so. The UI build is
`base: '/'`, the router owns `/`, and a UI backend's fallback for a browser
page request is `index.html`, tried after every API and protocol route, in
any language. A UI backend is the application, in any language, that
serves the build and answers `GET /api/status`.

It is written in `universal-navbar.md` under Where the UI is served
(:535-576) and in `universal-pages.md` under Hosting notes (:625-647).
`universal-navbar.md:573-576` names hyperweaver-ui's `/ui/` as the one
standing difference and says it ends when the agents' routes move under
`/api`.

## 2. Why

What the code shows is that hyperweaver-agent and zoneweaver-agent mount
their API at the origin root, so hyperweaver-ui could not own `/` and took
`/ui/`, while BoxVault and the catalog keep their machine surface under
`/api` and their UI at `/`. The industry splits the same way: Vagrant
Cloud, GitLab, Gitea, Grafana, Proxmox, Portainer, Home Assistant, Harbor,
Nexus and Jenkins serve the UI at `/` with the API under a prefix; Vault,
Consul, Nomad, Artifactory 7 and Cockpit put the UI under a prefix because
the API owns their root. The STARTcloud UI backends cannot take a redirect
(GitHub Pages issues none, and BoxVault's root links are in emails,
notifications and badges), so `/` is the rule.

## 3. What this repository does today

Why: two mounts of the same SPA and `/ui`-bound redirects are what the
items in section 4 remove, and the agents' root mounts are what holds
them.

From `index.js:119,213,272,326` and `routes/index.js:494,503-508`:
`/api/*`, `/api-docs`, `/agent/api-docs` and `/docs` are mounted at the
root; `express.static('./ui')` is mounted at the root with a `*splat`
catch-all sending `ui/index.html`, and a second `/ui` static mount with a
`/ui/*splat` fallback sits in the router, so the SPA answers at both `/`
and `/ui`. From `controllers/OidcController.js:185-306` and
`auth/oidcLogout.js:39`: the server redirects the browser to
`/ui/auth/callback#token=` and `/ui/login?...`, and the post-logout
redirect URI is `/ui/login?logout=success`. From
`.github/workflows/prod-build.yml:48-51,71`: the UI tarball is unpacked
into `./ui` and the bundled docs are served from `ui/docs` at `/docs`. In
Aggregated mode the browser uses `/api/*` and `/api/agents/{id}/*` here
and the server forwards to the agents' roots through `utils/wsProxy.js`.

Both agents still mount at the root:
`../zoneweaver-agent/routes/MachineRoutes.js:108-244` and
`../hyperweaver-agent/internal/server/server_routes.go:14-15,188-303`
(only `/api/status` and `/api/config/ticket` carry the prefix), and the
pinned UI still builds at `/ui/` (`../hyperweaver-ui/vite.config.js:53`;
`package.json:5` pins 0.10.12 whose `ui/index.html:12-27` loads
`/ui/assets/*`).

## 4. What joining the rule means here, in order

Why: done out of order, a `base: '/'` build lands on a server that still
sends the browser to `/ui/login` and the login loop never closes.

1. Drop the second `/ui` static mount and its fallback
   (`routes/index.js:503-508`) once the UI build is `base: '/'`; the root
   mount and its catch-all (`index.js:119,326-328`) are the rule already.
   Deciding source: `universal-navbar.md:535-576`.
2. Land the OIDC redirects on `/auth/callback` and `/login`
   (`controllers/OidcController.js:185,195,199,217-218,234,240,249,252,293,303,306`),
   and register the post-logout redirect URI as `/login?logout=success`
   (`auth/oidcLogout.js:39`) on the identity provider. Deciding source:
   `universal-session.md:280-291`, `universal-navbar.md:535-576`.
3. Consume a hyperweaver-ui build made with `base: '/'`
   (`../hyperweaver-ui/notifications.md` lists its side); the agents must
   have moved their routes under `/api` first, since the same build serves
   them. Deciding source: `universal-navbar.md:573-576`;
   `priorities.yaml:107-114`.

## 5. Rulings that bind this repository

Why: each ruling is one value every UI backend in the estate agrees on,
and a UI backend that keeps its own breaks the shared UI and the shared
docs for all of them.

- Only `CONFIG_DIR` may come from the environment, and there is no
  environment switch at all: production versus development is chosen by
  which config directory exists. `utils/config.js:10-11` reads
  `CONFIG_PATH`, `index.js:106` reads `PORT`, `utils/loggerCore.js:158`,
  `utils/Logger.js:85`, `controllers/mail/transport.js:64-65` and
  `controllers/RegistrationController.js:382` read `NODE_ENV`, and
  `routes/index.js:483` reads `npm_package_version`; the systemd unit sets
  `NODE_ENV` and `CONFIG_PATH` (`packaging/DEBIAN/systemd/hyperweaver-server.service:16-17`).
  Required change: `CONFIG_DIR` (default `/etc/hyperweaver-server`) is the
  one variable; the port and the version are values in the file or in
  `package.json`, and every `NODE_ENV` branch reads a value in the file
  instead. Deciding source: `universal-config.md:57-60,70`;
  `priorities.yaml:193`.
- Agent API key prefix is `hw_` everywhere, format `hw_<key_id>.<secret>`.
  `controllers/servers/registry.js:48` documents `wh_abc123def456...`.
  Required change: the swagger example reads `hw_`. The server never parses
  the prefix (`models/server.model.js:190-213`; `models/serverRequests.js:254-287`).
- No `/ui` basepath once the agents move under `/api` (section 4).
- Request bodies are `snake_case`; the status payload's own members
  (`logoUrl`, `baseUrl`, `reqType`, `fallbackCustomerId`) are the one
  named exception. `controllers/servers/registry.js:96` reads
  `entityName`, `apiKey`, `allowInsecure`;
  `controllers/RegistrationController.js:214` reads `confirmPassword`,
  `organizationName`, `inviteCode`. Required change: every body member
  renamed with the UI adapter in the same release. Deciding source:
  `universal-validation.md:145-153`; `universal-identity.md:239-243`;
  `priorities.yaml:186`.
- Password minimum is 15. `controllers/RegistrationController.js:231`
  hardcodes 8, `config/swagger.js:162` documents 8,
  `packaging/config/production-config.yaml:660-669` defaults
  `local_password_min_length` to 8 with a floor of 4. Required change: the
  route reads the configured minimum, default 15, and the four composition
  knobs (`production-config.yaml:671-705`) stay off. Deciding source:
  `universal-validation.md:154-156,280,292-294`.
- Sidebar entries come only from feature exports, never from the status
  payload. hyperweaver-ui draws its own tree
  (`../hyperweaver-ui/src/components/SidebarTree.jsx`); when the family
  converges on the shared UI that tree becomes a feature's
  `sidebar(status, account)` export answering `sections`, `tree` or
  `views`, its badges resolved from the events stream, and `/api/status`
  here carries no entries. The `actionMenu` swap (the header's account
  slot draws a feature's action menu and the user menu moves to the
  sidebar's foot) is used by no estate app today and names hyperweaver as
  its first fit; nothing here changes for it now. Deciding source:
  `universal-navbar.md:358-475`; `universal-pages.md:602-621`;
  `UI-GROWTH-GUIDE.md:56`.
- No workflow carries a hand-written smoke script.
  `.github/workflows/ci.yml:53-56` runs `npm run sync-versions || echo …`
  and `npm run generate-docs || echo …` as a "Verify scripts run" step, an
  ad-hoc check that cannot fail. Required change: the step goes; a check
  that must survive becomes a proper tool in a reusable workflow, and a
  browser test tool is a normal step of the standard `ci.yml`, the same
  shape in every repository of its class. Deciding source:
  `priorities.yaml:276-281`; `UI-GROWTH-GUIDE.md:62`.

## 6. Stale documentation in this repository

Why: an operator following either file puts certificates and config keys
where nothing reads them.

- `README.md:43` says certificates live in `./certs/` as `private-key.pem`
  and `certificate.pem`. The paths are `server.ssl_key_path` and
  `server.ssl_cert_path` (`index.js:336-337`; `utils/sslSetup.js:15-16`),
  shipped as `/etc/hyperweaver-server/ssl/key.pem` and `cert.pem`
  (`production-config.yaml:175,182`). Required change: the README names the
  config keys and the shipped paths.
- `packaging/DEBIAN/man/hyperweaver-server.yaml.5:20-53,87-98,134-151,187-256`
  documents a key tree (`app:`, `ssl:`, `security.jwt_secret`, `cors:`,
  `backend_servers:`, `environment.trust_proxy`) that nothing loads. The
  loaded keys are `frontend.port` and `frontend.trust_proxy`
  (`index.js:106,114`), `server.ssl_enabled`, `ssl_generate`,
  `ssl_key_path`, `ssl_cert_path`, `ssl_ca_path`, `force_secure`
  (`index.js:332-361`; `utils/sslSetup.js:11-16`),
  `authentication.jwt_secret` (`index.js:84`; `auth/passport.js:29`),
  `security.cors.*` (`index.js:109-111`), `agents.poll_interval` and
  `poll_timeout` (`utils/agentHealthPoller.js:13-20`). Required change: the
  man page is regenerated from the schema once section 7 lands.

## 7. Code gaps against the contracts

Why: the shared UI reads nothing but the contract surfaces, so every gap
below is a page it cannot draw or a write it cannot explain on this UI
backend.

- Config schema route and files. There is no `*.schema.yaml` in the tree
  and no `GET /api/config/<name>/schema` (`routes/index.js:474` serves only
  `/api/config/ticket`); the config is one `config.yaml` whose every leaf
  is a metadata node around `value` (`production-config.yaml:38-59`) with
  `_sections` (`:6-36`) and `type: collection` with `item_schema`
  (`:839-893`). Required change: plain leaves under
  `/etc/hyperweaver-server/<name>.config.yaml`, one JSON Schema 2020-12
  document per file shipped beside the code and served at
  `GET /api/config/<name>/schema`, `_sections` becomes `sections`,
  `collection` becomes `type: object` with `additionalProperties`,
  `schemaVersion` in file and schema, migrations run by `postinst`, the
  file names listed as `config` in `/api/status`. Deciding source:
  `universal-config.md:64-72,186-188,192-203,249-257,261-274,290-303,313`.
- `PUT /api/settings`. `controllers/settings/configWriter.js:35-78` sets
  any value at any dotted path, creates unknown paths (`:47-48`) and only
  logs an unsafe path (`:72-74`); `:18-22` re-serializes the whole
  document, dropping the administrator's comments; `:22` writes with
  `writeFileSync`, non-atomic and without mode 0600; `:83-87` tests
  `serverPort`, `sslEnabled`, `corsWhitelist`, `sessionTimeout`, which are
  not config keys, so `requiresRestart` is always false;
  `controllers/SettingsController.js:155-161` answers 500 on failure.
  Required change: the route is `PUT /api/config/<name>`; it restores
  masked secrets, validates the merged result against the schema, answers
  422 with `errors[]` of pointers before any write, writes atomically with
  a backup beside it at 0600, keeps comments by editing leaves, and the
  200 carries `requires_restart` from the schema. Deciding source:
  `universal-config.md:49-56,196-198,236-245`.
- `GET /api/rules`. No route (`routes/index.js:41-508`). Required change:
  the UI backend's forms (`register`, `login`, `password`, the OIDC
  provider key) as one JSON Schema 2020-12 document with the estate
  `$defs`, served before login. Deciding source:
  `universal-validation.md:72-162`.
- Refused-write bodies. `controllers/RegistrationController.js:217-252`
  answers `{ success: false, message }` with 400 for a rule failure;
  `controllers/SettingsController.js:155-161` answers 500. Required change:
  `application/problem+json` with `type`, `title`, `status`, `errors[]` of
  `pointer`, `rule`, `params`, `detail`; 422 for a rule failure, 409 for
  `unique`, 400 only for an unreadable request. Deciding source:
  `universal-validation.md:357-407`.
- `GET /api/events`. No route. The UI backend holds a session it can end
  from outside the tab (`controllers/OidcController.js:334-375` receives
  the back-channel logout), so it streams the `session` topic. Required
  change: one stream at `/api/events`, `session-terminated` on the
  `session` topic, the frame grammar, the ring and `Last-Event-ID`, the
  `events` token and object in `/api/status`. Deciding source:
  `universal-events.md:68-88,92-116,120-167,178-201,252-271,275-293`.
- `GET /api/health`. `routes/index.js:476-485` answers
  `{ success, status: 'healthy', timestamp, uptime, version }`, the version
  from `process.env.npm_package_version`, which `node index.js`
  (`packaging/DEBIAN/systemd/hyperweaver-server.service:11`) leaves unset.
  Required change: `{ status, timestamp, services }` with `status` one of
  `ok`, `warning`, `error`; the version comes from `package.json` the way
  `controllers/StatusController.js:13` reads it. Deciding source:
  `universal-navbar.md:666,895-899`; `priorities.yaml:199-203`.
- `GET /api/status`. `controllers/StatusController.js:75-86` answers
  `role`, `version`, `auth`, `datacenter_label` and no `features` array,
  so the shared UI would render every surface, the footer included.
  Required change: add `brand`, `features`, `collections`, `links`,
  `ticket` (null while `/api/config/ticket` answers), `config` (the file
  names of section 7), `events`; `features` lists `footer` for the footer
  row and `health` for its heart once `/api/health` has the shape above,
  and the `search` token stays off until a `GET /api/search` answers
  `{ query, kinds, scope, counts, results, next }` in the shape of
  section 8b, the status payload then carrying
  `"search": { "path": "/api/search", "kinds": ["host"] }`
  (no route exists, `routes/index.js:41-508`; the estate-wide channel is
  built on the identity provider first, `priorities.yaml:162-167`);
  `analytics` is optional and, when present, `{ script_url, attribute, value }`;
  the `auth` vocabulary of the estate is `backend`, `idp` and `cookie`,
  this UI backend's `local`, `ldap`, `oidc` tokens are resolved with
  hyperweaver-ui before the switch. Deciding source:
  `universal-navbar.md:276-288,578-632,649-677,795-910`.
- Reserved first segments. `/api-docs`, `/api-docs/swagger.json`,
  `/agent/api-docs`, `/agent/api-docs/swagger.json` (`index.js:213,251,272,282`)
  are program paths outside `/api`, and `api-docs`, `agent`, `ui` are not
  reserved first segments; `controllers/RegistrationController.js:72-119`
  creates an organization under any name, checking only that none exists.
  Required change: the documentation surface moves under `/api` or joins
  the reserved list, and organization creation refuses every reserved
  first segment, the build's own folders `assets`, `brand`, `locales`,
  `fonts` and `themes` and `api` included. Deciding source:
  `universal-navbar.md:535-576`; `universal-pages.md:136-153`.
- Toasts. No push route, no VAPID key, no service worker and no
  `Service-Worker-Allowed` header anywhere in the tree
  (`routes/index.js:41-508`; `index.js:105-329`). Required change, when
  toasts land here: the push worker is served from the build with
  `Cache-Control: no-cache`, registered at scope `/push/` with
  `Service-Worker-Allowed` sent for that path alone, carries no `fetch`
  handler, and the subscription routes live under `/api`; `push` is a
  reserved first segment. Deciding source: `universal-navbar.md:994-1010`;
  `universal-pages.md:136-139`.
- RP-initiated logout. `auth/oidcLogout.js:34-40` sends `id_token_hint`
  and `post_logout_redirect_uri` only. Required change: add `client_id`
  and `state`. Deciding source: `universal-navbar.md:1044`;
  `universal-session.md:134`.
- Back-channel logout. `controllers/OidcController.js:346-364` correlates
  by `sub` and logs `sid`; `models/user.model.js:4-89` stores no `sid`.
  Required change: store the ID token's `sid` at login and revoke on the
  matching logout token. Deciding source: `universal-navbar.md:1051-1053`.
- Session wire shape. Login is `POST /api/auth/login` (`routes/index.js:42`)
  with `Authorization: Bearer` (`auth/auth.js:141`; `auth/passport.js:28`),
  the OIDC callback hands the JWT in a URL fragment
  (`controllers/OidcController.js:293`), and there is no
  `/api/auth/refresh-token`, `/api/auth/oidc/exchange` or `/api/user`.
  Required change: `POST /api/auth/signin`, `x-access-token`,
  `POST /api/auth/refresh-token`, `/api/auth/oidc/exchange` from a `code`
  on `/auth/callback`, `GET /api/user`, `POST /api/auth/oidc/logout`
  answering `redirect_url` (today `POST /api/auth/logout`,
  `controllers/auth/session.js:192-231`). Already conforming:
  `GET /api/auth/oidc/issuers` (`routes/index.js:61`),
  `GET /api/userinfo/claims` (`routes/index.js:86-92`), `?prompt=none`
  (`controllers/OidcController.js:84-91`). Deciding source:
  `universal-session.md:118-134,169-193,280-291`.
- Preferences. No `PATCH /api/user/preferences` or `GET` on it and no
  preference columns (`models/user.model.js:4-89`). Required change: the
  route, `language`, `theme`, `timezone` on the user, delegation to the
  identity provider for an OIDC session, a violation answered as the
  validation contract's 422. Deciding source:
  `universal-session.md:132,307-319`; `preferences-and-branding.md:107-131,305-330`.
- Dependency bump. `.github/workflows/bump-ui-pin.yml:18-28` polls for a
  `hyperweaverUiVersion` release; the estate pattern is a `dependency-bump.yml`
  answering the UI's `dependency-update` dispatch with a `bump/startcloud-ui`
  pull request over `startcloudUiVersion`, CI fetching the pinned tarball
  into `ui/` before the build. Required change: when this UI backend
  consumes startcloud-ui, the workflow file is copied from BoxVault, not
  written. Deciding source: `universal-navbar.md:509-533`;
  `priorities.yaml:270-275`.

## 8. Code bug

Why: every invitation and welcome email sent from a production install
links to a host that does not exist.

`controllers/mail/transport.js:16` reads `config.app` and
`controllers/mail/invitation.js:32` and `controllers/mail/welcome.js:25`
read `getAppConfig()?.frontend_url`; no shipped config has an `app:`
block (`production-config.yaml:38-59` carries `frontend.frontend_url`
under `.value`), so every invitation and welcome link falls to
`https://localhost:3001`. Required change: read
`config.frontend.frontend_url.value` (`auth/oidcLogout.js:39` already
does). Once section 7 lands the key is a plain leaf.

## 8a. 2026-09-29: the person's Hyperweaver connection lives on the identity provider, the deploy preference lives here

Why, in Mark's words: an integration is "a value we store for the user, becasue there is no backend otherwise for the storage of these", but the preference itself belongs to "the api that stores their prefence", meaning "THE HYPERWEAVER-SERVER of which we KNOW which Oauth app they signed in on so we alreayd know the URL for it if they consented to it, that app would be what responds to the prefence"; and until this server has caught up, "if we can have a hybrid I guess its fine".

What the identity provider holds, built in authorization-server 1.9.1: one `user_integration` row per person for the service `hyperweaver`, `settings.servers[] { origin, label, default }`, the connection alone, which Hyperweaver servers the person attached and which is the default. It is answered on `GET /api/user` as `integrations`, on `/userinfo` and as the `integrations` claim on the access and id tokens of every client that requests the `integrations` scope, shape `[{ id: "hyperweaver", status, connected_at, settings }]`, absent while nothing is connected. A sending app (the catalog, BoxVault) reads the claim, finds this server's origin and asks this server; a person with no row is local and gets the `hwa://` link. As the stopgap the row also carries `settings.deploy_target`, `local` or one of the origins; that member leaves the identity provider the day item 2 below answers.

1. Register this server on the person's connection at their first sign-in through the identity provider, where `controllers/OidcController.js:185-306` completes the callback: `POST {issuer}/api/user/integrations/hyperweaver/connect` `{ origin: "<this server's https origin>", label: "<this server's display name>" }` with the person's access token. The first server registered becomes the default; a repeated call relabels and changes nothing else; a `422` carries `errors[]` with pointers `/origin` and `/label`. The client block for this server on the identity provider lists the `integrations` scope. The person's own record of the connection is `GET {issuer}/api/user/integrations`, and `DELETE {issuer}/api/user/integrations/hyperweaver` disconnects; neither is called by this server.
2. Own the deploy preference. For the signed-in person this server answers which target their deploys go to and every other deploy default at its own API, `GET /api/user/deploy` and `PATCH /api/user/deploy`, the write validated by the `deploy` form of this server's `GET /api/rules` (section 7) with the validation contract's `422` and pointers, stored on this server's user row beside the preference columns section 7 already owes. The identity provider's `settings.deploy_target` stopgap is read by nobody once this route answers; tell authorization-server when it does and the member is removed there.
3. Draw the preference on the shared UI's Preferences section on this host, the way mode, theme and language draw there, and hand it to the deploy feature the startcloud-ui session is writing (`universal-deploy.md`, its notifications.md carries the member names).

Not this server's: the `hwa://` link and the agent's own sign-in paths (`../hyperweaver-agent/notifications.md`), and the identity provider's routes above. Deciding source: `../authorization-server-private/src/main/groovy/startcloud/integration/UserIntegrationService.groovy`; `../authorization-server-private/src/main/groovy/startcloud/api/UserIntegrationsApiController.groovy`; `universal-identity.md`, decision 123 and the connected-service decision the startcloud-ui session is adding; `universal-session.md`, Backend session provider.

## 8b. Search: the organization filter on a proxied search, and the server's own kinds

The shared UI draws search, the Ctrl+K dialog, the navbar icon, the page filters and the `/search` page, only while the backend's `features` lists `search`. A backend joins search in five lines:

1. List `search` in `features` and add `"search": { "path": "/api/search", "kinds": [ ... ] }` to the status payload, naming only the kinds it answers.
2. Serve `GET {path}?q=&kinds=&scope=&limit=&after=`. `q` is 2 to 200 characters, otherwise a 422 naming the field; `limit` is 1 to 50; `scope` is `org:<name>` or `collection:<key>`; every word matches case-insensitively as a substring; each kind shows exactly what its list route shows the caller; the answer carries `Cache-Control: no-store`.
3. Answer `{ query, kinds, scope, counts, results, next }` in the shape below, each kind's count `{ value, relation }` with `relation` `eq` or `gte`. Results are sorted by score descending, then match position in the title, then title, then id. `next` is a cursor only when `kinds` names one kind, and null otherwise or at the end.
4. Every result carries `kind`, `id` (a natural key unique per kind), the locator members as deep as the hit goes, `source` or null, `score` (3 exact, 2 prefix, 1 inside the name, 0 another field), `title`, `subtitle`, `matched`, `highlight` as offsets into the matched field, and `facets`. Every member is a string except `collection`, `source`, `facets` and `highlight`, and a string is never null. A result never carries a URL, a path, HTML or a host, and a highlight fragment comes only from a field the person could list. `source` names the BoxVault or catalog item a local copy came from, as locators.
5. A UI feature exports `searchKinds` for any kind it owns; a kind no feature owns draws without a link.

The request:

```text
GET {path}?q=&kinds=&scope=&limit=&after=
```

The answer:

```json
{
  "query": "web",
  "kinds": ["machine", "service"],
  "scope": "",
  "counts": {
    "machine": { "value": 12, "relation": "eq" },
    "service": { "value": 50, "relation": "gte" }
  },
  "results": [
    {
      "kind": "machine",
      "id": "web-1",
      "collection": null,
      "org": "",
      "name": "web-1",
      "version": "",
      "provider": "",
      "architecture": "",
      "anchor": "",
      "source": null,
      "score": 2,
      "title": "web-1",
      "subtitle": "Zones · running",
      "matched": "name",
      "highlight": { "name": { "text": "web-1", "spans": [[0, 3]] } },
      "facets": { "status": "running" }
    }
  ],
  "next": null
}
```

This server never fans out. The UI sends one search per host through `/api/agents/{id}/…`, the proxy path it uses for every host read, and one to this server for its own kinds; each answer is its own request.

Each backend that lists `search` serves `GET /opensearch.xml` at its own origin, an OpenSearch 1.1 description: `ShortName` from `brand.name`, a `Description`, an `Image` from `brand.logo_url`, and a `Url` of type `text/html` whose template is `<its origin>/search?q={searchTerms}`, the origin written in by the backend the way it stamps `index.html`. While `search` is listed the UI draws `<link rel="search" type="application/opensearchdescription+xml" href="/opensearch.xml">`, so a browser can add the site as a search engine.

Required change: the proxy applies the organization filter to a proxied agent search, the one a proxied machine list gets, so a result the person could not list through this server never reaches the browser. `GET /api/search` here answers the kind `host` over the registry rows the person can list, in the shape above; `features` lists `search` and the status payload carries `"search": { "path": "/api/search", "kinds": ["host"] }`, naming this server's own kinds alone.

## 8c. A `landing` token this server does not list

The shared UI sends a signed-out visitor straight to the sign-in page, the path they asked for kept as the return path, unless the backend's `features` lists `landing`. A backend that lists it keeps its signed-out pages and the sign-in placard.

Required change: none beyond leaving the token out. When the `features` array of section 7 lands, it does not list `landing`, so a signed-out visitor to this server is sent to sign in.

Deletion of this section is the confirmation, the way every other item here works.

## 8d. 2026-10-06: the chart feed relayed, the server collecting nothing

The shared UI's charts are one browser store per series fed two ways: a live sample pushed on the one event stream, and history read once and spliced under it. The agents sample and publish (`../hyperweaver-agent/notifications.md` item 1, `../zoneweaver-agent/notifications.md` item 16); this server collects no series of its own.

Required change, within item 2 of section 0:

1. The `monitoring` topic of each agent's stream is relayed on this server's one stream with `agent_id` added to every event's data, as the `tasks` and `hosts` topics are; this server subscribes to an agent's `monitoring` topic only while a browser subscribed to this server's stream has asked for that agent's, so an agent samples for nobody.
2. A proxied `GET /api/agents/{id}/monitoring/*` passes `since` and `until` through unchanged and answers the agent's body unchanged; no count parameter is added or read here.
3. `GET /api/agents/{id}/monitoring/status` is the agent's answer unchanged.

Deciding source: `../startcloud-ui/docs/guides/universal-events.md`, the `monitoring` topic and the relay rule; `universal-navbar.md`, the host overview's The window and The browser's ring.

Deletion of this section is the confirmation, the way every other item here works.

## 8e. Deploy to a server: the catalog's probe of this server's status

A person whose deploy target is this server presses Deploy on a catalog provisioner; the catalog page asks `GET <this origin>/api/status` first, so it can say the server is not answering, then opens `<this origin>/?create=machine&provisioner=…&provisioner_version=…&provisioner_url=…&provisioner_catalog=…`, which the shared UI moves to the first host that creates and its wizard installs the family there through `POST /api/agents/{id}/provisioning/catalog/install`.

Required change:

1. `GET /api/status` answers a cross-origin request from `https://provisioner-catalog.startcloud.com` and from every origin `security.cors` lists, with `Access-Control-Allow-Origin` echoing it and `Vary: Origin`, and its OPTIONS preflight answers 204; the route stays public.
2. The proxied `provisioning/catalog/install`, `provisioning/catalog/sources` (its `GET` and `POST`) and `provisioning/catalog/health` pass through unchanged, under the same role checks as the other provisioning routes.

Deciding source: `../startcloud-ui/docs/guides/universal-deploy.md`.

Deletion of this section is the confirmation, the way every other item here works.

## 8f. The hub's notifications live on this server's stream

Within item 2 of section 0, the one stream carries the `notifications` topic for each signed-in person: `unread-count`, `notification-created` (the row as `GET /api/notifications` answers it), `notification-read`, `notification-unread`, `notification-dismissed`, `inbox-read-all` and `inbox-cleared`, the names of `../authorization-server-private/notifications.md` item 1, relayed from the identity provider's stream with the token this server holds for the person, `GET {issuer}/api/events?topics=notifications`, opened while the person holds a connection here and closed with their last one; `/api/notifications` proxies the hub's routes with the same token.

Deletion of this section is the confirmation, the way every other item here works.

## 8g. The agent's protocol scheme is `hwa`

The Universal Deploy Contract, `../startcloud-ui/docs/guides/universal-deploy.md`,
section "The agent's scheme", fixes the desktop agent's link for the whole
estate: a sender writes `hwa://open?<query>`, and a reader accepts `hwa`,
`hyperweaver-agent` and `com.startcloud.hyperweaver-agent`, in the
`<scheme>://open` and the `<scheme>:/open` form alike. The section carries
the reasons; nobody re-derives the scheme from the RFCs.

Required change: none in code today, since this server never writes or
reads the agent's link; `README.md`, the man pages and every Swagger
description that name a Hyperweaver link or scheme read `hwa://open`, and
any future code that writes or reads the agent's link reads that section
first.

Deletion of this section is the confirmation, the way every other item here works.

## 8h. List `rules` in `/api/status` `features` while `GET /api/rules` is served

The shared UI reads the validation rules document, `GET /api/rules`, only behind the `rules` feature token: while the status lists it the document is read once before sign-in, and without it no request is made and every form validates on the client's own defaults.

Required change: when the `GET /api/rules` route of section 7 lands, `features` of `GET /api/status` lists `rules` beside the tokens it already lists; until then the token stays off and the shared UI asks for no document here.

Deciding source: `../startcloud-ui/docs/guides/universal-validation.md`, The rule set; `../startcloud-ui/docs/guides/universal-navbar.md`, the feature-token table under The status payload.

Deletion of this section is the confirmation, the way every other item here works.

## 8i. `release_notes` and `assets` on this server's own update check

The shared UI's Update page at `/admin/update` draws, beside the versions and the links the check answers, the release notes as rendered markdown and an Assets fold listing the release's files, each a name link with its size and its checksum where one is carried. The host's Update page of the Agent group reads the remote agent's own check through `/api/agents/{id}/app/updates/check`, which passes through unchanged.

Required change: `GET /api/app/updates/check` at this server's own root answers `release_notes`, the release's own markdown as a string, and `assets`, an array of `{ name, url, size, checksum }`, `size` in bytes, `checksum` null while the release carries none, each member null while this server holds none, beside `current_version`, `latest_version`, `update_available`, `release_url`, `release_date` and `changelog`:

```json
{
  "current_version": "0.9.0",
  "latest_version": "0.10.0",
  "update_available": true,
  "release_url": "https://github.com/Makr91/hyperweaver-server/releases/tag/v0.10.0",
  "release_date": "2026-10-04T00:00:00Z",
  "changelog": "https://github.com/Makr91/hyperweaver-server/blob/main/CHANGELOG.md",
  "release_notes": "### Features\n\n* ...",
  "assets": [
    {
      "name": "hyperweaver-server_0.10.0_amd64.deb",
      "url": "https://github.com/Makr91/hyperweaver-server/releases/download/v0.10.0/hyperweaver-server_0.10.0_amd64.deb",
      "size": 38692454,
      "checksum": "e9c7a4f2b8d6e3c1a0f9b7d5e2c4a6f8b1d3e5c7a3f0c9a1b7e4d2c8f5a6b1d0"
    }
  ]
}
```

Deciding source: `../startcloud-ui/docs/guides/universal-navbar.md`, the `update` row of the feature-token table and the Update row of the host pages table; the wire as `npm run mock` in `../startcloud-ui` answers it (`scripts/mock/agent-settings.js`).

Deletion of this section is the confirmation, the way every other item here works.

## 8j. `box_<provider>` on the Deploy hand-off passes through

The catalog's Deploy link now carries one `box_<provider>` member per
provider a version is verified with, `box_virtualbox`, `box_zone`,
`box_bhyve`, `box_utm`, the key `box_` and a provider name of lowercase
letters, digits, underscores and hyphens, the value
`organization/name@version@architecture@url`, beside the `provisioner`
members on `<this origin>/?create=machine&…`.

Required change: the query reaches the hosts page unchanged, every
member of it, so the shared UI moves it to the first host that creates
and lands the box of that host's hypervisor on the create wizard's Box
step; the proxied `PUT /api/agents/{id}/config/storage` passes through
unchanged, the wizard writing the box's registry through it where the
host holds none.

Deciding source: `../startcloud-ui/docs/guides/universal-deploy.md`, "The
query" and "The receiver".

Deletion of this section is the confirmation, the way every other item here works.

## 8k. The Deploy hand-off's four words pass through to the hosts page

The Deploy link of the catalog and of BoxVault now carries one of four
words under `create` on `<this origin>/?create=…`: `machine`, the create
wizard; `provisioner`, the host's Provisioner catalog page with the handed
family's card marked and Install one press away; `template`, the host's
Templates page with the pull dialog filled; and `source`, the Add source
dialog of the catalog page for a `provisioner_catalog` or the Add registry
dialog of the Templates page for a `box_url`. The shared UI's hosts page
counts the hosts whose registry row lists the word's token,
`machines` and `machine-create`, `provisioner-registry` or `templates`,
moves the query to the one host that takes it, and with several makes the
page the pick under the hand-off's banner.

Required change: the query reaches the hosts page unchanged, every member
of it, whatever the word; the proxied `POST /api/agents/{id}/provisioning/catalog/sources`,
`POST /api/agents/{id}/templates/pull` and `PUT /api/agents/{id}/config/storage`
pass through unchanged under the same role checks as the other
provisioning and configuration routes, the pages of the three new words
writing through them on the person's press; `GET /api/servers` keeps
answering each row's `capabilities.features` as the agent reported them,
`provisioner-registry` and `templates` among them, since the pick is read
from the rows alone.

Deciding source: `../startcloud-ui/docs/guides/universal-deploy.md`, "The
query", "The words" and "The receiver".

Deletion of this section is the confirmation, the way every other item here works.

## 8l. The person's token reaches the agent's registry reads

Why, in Mark's words: "i want server wide to be the FALLBACK when there is no user key"; "if a user is alreayd logged into startcloud they will show as logged in as that user in the UI for the hyperweaver-agent on their local instance? ... and the last last resort is the login via api key".

Required change: the proxied `GET /api/agents/{id}/templates/remote/{source}` and `GET /api/agents/{id}/templates/remote/{source}/{org}/{box}` carry `x-registry-token: <the person's OIDC access token>`, the token `extractOidcAccessToken(req)` answers for the BoxVault proxy (`controllers/BoxVaultController.js:45`), while the session is federated and nothing otherwise, where the agent request is built (`controllers/servers/proxy.js:332-391`, `models/serverRequests.js:183`); the agent sends it to the registry before any credential of its own. No other proxied path gains the header; a queued pull never carries it.

Deciding source: `../startcloud-ui/docs/guides/universal-navbar.md`, the create wizard bullet of Host overview; `../hyperweaver-agent/notifications.md` item 1, the agent's side of the same ladder.

Deletion of this section is the confirmation, the way every other item here works.

## 8m. The certificate store: `/api/certs`, the `certs` topic and three feature tokens

The shared UI carries a Certificates feature: a vault in the browser's IndexedDB, every conversion done in the browser by a WASM engine, and a Sync form on which a person ticks the kinds mirrored to the backend they are signed in to. It draws on any backend whose `features` lists `certs`, and its Shared and Sync pages on any that also lists `certs-store` and serves the store. BoxVault serves the store first (`../BoxVault/notifications.md` item 2); this server joins when it wants certificates shared across its organizations, the way its organizations mirror BoxVault's (section 0, item 8).

Required change, when this server joins:

1. `features` lists `certs`, `tools` beside it so the Certificates row of the sidebar's shared Tools group draws Convert, Decode, Match, Compare, Chain and Generate, and `certs-store` once the routes below answer; `events.topics` lists `certs`. `tools` is the shell's generic token: it draws the one TOOLS heading every feature with tools folds its own row into, and a server that lists it without `certs` draws whatever its other features add there.
2. `GET /api/certs?organization=`, `GET /api/certs/{id}`, `POST /api/certs`, `PUT /api/certs/{id}`, `DELETE /api/certs/{id}`, the row shape, the four reading lines, the creator-or-manager write rule, the 403 and 404 bodies and the `cert-updated` and `cert-removed` events exactly as `../BoxVault/notifications.md` item 2 writes them and as `../startcloud-ui/scripts/mock/certs.js` answers them.
3. `certs` is a reserved first segment of the shared UI; no route of this server takes it at the root.

Deciding source: `../BoxVault/notifications.md` item 2; `../startcloud-ui/scripts/mock/certs.js`.

Deletion of this section is the confirmation, the way every other item here works.

## 8n. Secrets are kinds of the store, and a row shared to a host reaches that host's store

The store of section 8m grows the secret kinds of `../BoxVault/notifications.md` item 3, `password`, `api_key`, `basic_auth`, `key_pair`, `oauth_client`, `ssh_key`, `file` and `custom`, each with its members, `extra` and `profile`, with every route, line, rule and event unchanged, and every hyperweaver-agent and zoneweaver-agent serves the same store on itself (`../hyperweaver-agent/notifications.md` item 1), reading its own rows at a machine's prepare.

Required change, when this server serves the store: the proxied `/api/agents/{id}/certs` routes pass through unchanged, so the shared UI reads a host's rows as it reads the server's; and a row of this server's store carries `shared_to`, the registry ids of the agents it is shared with, a row shared to an agent written to that agent's store through `POST /api/agents/{id}/certs` with `origin` this server's row id, kept in step on every `PUT` and removed on `DELETE`, so a key added once on the server reaches every agent that is allowed it and is gone from each at the next prepare after its removal, with no copy of a secret ever travelling through the browser.

Deciding source: `../BoxVault/notifications.md` items 2 and 3; `../hyperweaver-agent/notifications.md` items 1 and 2; `../startcloud-ui/docs/guides/universal-navbar.md`, the `certs-store` token row.

Deletion of this section is the confirmation, the way every other item here works.

## 8o. The default domain choices of a create

The create wizard's one Name takes the host's default domain for a bare name. The domain comes from a chain the person picks from on the General step's Edit parts: the organization's base domain, the person's own preference, the agent's default, the browser's preference and a custom value.

Required change:

1. The proxied `GET /api/agents/{id}/machines/defaults` answers the agent's body with `settings.domain_choices` grown by two rows where this server holds them: `{ "source": "organization", "domain": "<the active organization's base domain>" }` and `{ "source": "user", "domain": "<the person's default domain preference>" }`, each row absent while the value is empty; the agent's own `{ "source": "agent", "domain" }` row passes through (`../hyperweaver-agent/notifications.md` item 4).
2. The organization row carries `base_domain`, set by an owner or admin on the organization's settings and mirrored from the identity provider's organization where it answers one; `GET /api/organizations` answers it.
3. `PATCH /api/user/preferences` and its `GET` take `default_domain` beside `language`, `theme` and `timezone`, validated as a domain name by the `preferences` form of `GET /api/rules`.

Deciding source: `../startcloud-ui/docs/guides/universal-navbar.md`, the create wizard bullet of Host overview, the General step.

Deletion of this section is the confirmation, the way every other item here works.

## 9. Where the contracts live

Why: a change made from memory of a contract instead of the file drifts
from every other UI backend on the first release.

- `../startcloud-ui/docs/guides/universal-navbar.md`,
  `universal-pages.md`, `universal-session.md`, `universal-events.md`,
  `universal-validation.md`, `universal-config.md`,
  `preferences-and-branding.md`, `universal-identity.md`,
  `UI-GROWTH-GUIDE.md`
- `../authorization-server-private/priorities.yaml`
- `../hyperweaver-docs/docs/roadmap.md`
- `../startcloud-ui/README.md`: Hosting the UI
- `../hyperweaver-ui/notifications.md`: the UI side of the same rule and
  the feature-first tree
