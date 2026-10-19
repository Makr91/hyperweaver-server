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

1. Organizations, BoxVault's way. Why, in Mark's words: "I think the oidc strategies was an old way of mapping things, BoxVault has had the most success recently and I think that the server should match its styling". Today the session keeps the identity provider's `organizations` claim as it arrived, `auth/externalUser.js` gives a person one local organization found by invitation or email domain, and `utils/orgAccess.js` reads the session's list for a federated sign-in and the one local organization otherwise. BoxVault mirrors: every organization of the claim becomes a row of its own organizations table keyed by the identity provider's uuid, a person holds many memberships with one primary, and the mirror is synced exactly at every sign-in, added, updated and removed, the rules in one module its SCIM receiver shares (`../BoxVault/backend/app/auth/external-user-handler.js:66-174`, `../BoxVault/backend/app/utils/externalOrgs.js:138-194`, `../BoxVault/backend/app/utils/userOrgs.js`). Required change: the same machinery here, `org_uuid` the identity provider's uuid verbatim for a mirrored organization as `models/organization.model.js` already says, a membership table in place of the one `organization_id`, and `utils/orgAccess.js` reading the rows. The file is copied from BoxVault and adapted, not written.
2. The registry row's names. `GET /api/servers` answers the model's own `snake_case` attributes, and the shared UI reads `entity_name` from it. Two answers still hand-build `entityName`: `POST /api/servers` (`controllers/servers/registry.js`) and `PATCH /api/servers/{id}` (`controllers/servers/manage.js`); they are renamed with the body members section 5 asks for.

Deletion of this section is the confirmation, the way every other item here works.

## 5. Rulings that bind this repository

Why: each ruling is one value every UI backend in the estate agrees on,
and a UI backend that keeps its own breaks the shared UI and the shared
docs for all of them.

- Agent API key prefix is `hw_` everywhere, format `hw_<key_id>.<secret>`.
  `controllers/servers/registry.js` documents `wh_abc123def456...`.
  Required change: the swagger example reads `hw_`. The server never parses
  the prefix.
- Request bodies are `snake_case`; the status payload's own members
  (`logoUrl`, `baseUrl`, `reqType`, `fallbackCustomerId`) are the one
  named exception. `controllers/servers/registry.js` reads
  `entityName`, `apiKey`, `allowInsecure`;
  `controllers/RegistrationController.js` reads `confirmPassword`,
  `organizationName`, `inviteCode`. Required change: every body member
  renamed with the UI adapter in the same release. Deciding source:
  `universal-validation.md:145-153`; `universal-identity.md:239-243`;
  `priorities.yaml:186`.
- Password minimum is 15. `controllers/RegistrationController.js`
  hardcodes 8. Required change: the route reads the configured minimum
  through the `register` form of `GET /api/rules`, default 15, and the four
  composition knobs stay off. Deciding source:
  `universal-validation.md:154-156,280,292-294`.
- Sidebar entries come only from feature exports, never from the status
  payload. When the family converges on the shared UI the hosts tree
  becomes a feature's `sidebar(status, account)` export answering
  `sections`, `tree` or `views`, its badges resolved from the events
  stream, and `/api/status` here carries no entries. Deciding source:
  `universal-navbar.md:358-475`; `universal-pages.md:602-621`;
  `UI-GROWTH-GUIDE.md:56`.

## 7. Code gaps against the contracts

Why: the shared UI reads nothing but the contract surfaces, so every gap
below is a page it cannot draw or a write it cannot explain on this UI
backend.

- Refused-write bodies. `controllers/RegistrationController.js`
  answers `{ success: false, message }` with 400 for a rule failure.
  Required change: `application/problem+json` with `type`, `title`,
  `status`, `errors[]` of `pointer`, `rule`, `params`, `detail`; 422 for
  a rule failure, 409 for `unique`, 400 only for an unreadable request,
  through `middleware/validate.js` and the forms of `GET /api/rules`.
  Deciding source: `universal-validation.md:357-407`.
- Reserved first segments. `/api-docs`, `/api-docs/swagger.json`,
  `/agent/api-docs`, `/agent/api-docs/swagger.json` are program paths
  outside `/api`, and `api-docs`, `agent` are not reserved first
  segments; `controllers/RegistrationController.js` creates an
  organization under any name, checking only that none exists. Required
  change: the documentation surface moves under `/api` or joins the
  reserved list, and organization creation refuses every reserved first
  segment, the build's own folders `assets`, `brand`, `locales`, `fonts`
  and `themes` and `api` included. Deciding source:
  `universal-navbar.md:535-576`; `universal-pages.md:136-153`.
- RP-initiated logout. The OIDC logout sends `id_token_hint` and
  `post_logout_redirect_uri` only. Required change: add `client_id` and
  `state`. Deciding source: `universal-navbar.md:1044`;
  `universal-session.md:134`.
- Back-channel logout. `controllers/OidcController.js` correlates by
  `sub` and logs `sid`; `models/user.model.js` stores no `sid`. Required
  change: store the ID token's `sid` at login and revoke on the matching
  logout token. Deciding source: `universal-navbar.md:1051-1053`.
- Preferences. `PATCH /api/user/preferences` takes `language`, `mode`,
  `theme` and `motion`; `timezone` is not stored, and a federated session
  is not delegated to the identity provider. Required change: `timezone`
  on the user, delegation to the identity provider for an OIDC session, a
  violation answered as the validation contract's 422. Deciding source:
  `universal-session.md:132,307-319`;
  `preferences-and-branding.md:107-131,305-330`.

## 8a. 2026-09-29: the person's Hyperweaver connection lives on the identity provider, the deploy preference lives here

Why, in Mark's words: an integration is "a value we store for the user, becasue there is no backend otherwise for the storage of these", but the preference itself belongs to "the api that stores their prefence", meaning "THE HYPERWEAVER-SERVER of which we KNOW which Oauth app they signed in on so we alreayd know the URL for it if they consented to it, that app would be what responds to the prefence"; and until this server has caught up, "if we can have a hybrid I guess its fine".

What the identity provider holds, built in authorization-server 1.9.1: one `user_integration` row per person for the service `hyperweaver`, `settings.servers[] { origin, label, default }`, the connection alone, which Hyperweaver servers the person attached and which is the default. It is answered on `GET /api/user` as `integrations`, on `/userinfo` and as the `integrations` claim on the access and id tokens of every client that requests the `integrations` scope, shape `[{ id: "hyperweaver", status, connected_at, settings }]`, absent while nothing is connected. A sending app (the catalog, BoxVault) reads the claim, finds this server's origin and asks this server; a person with no row is local and gets the `hwa://` link. As the stopgap the row also carries `settings.deploy_target`, `local` or one of the origins; that member leaves the identity provider the day item 2 below answers.

1. Register this server on the person's connection at their first sign-in through the identity provider, where `controllers/OidcController.js:185-306` completes the callback: `POST {issuer}/api/user/integrations/hyperweaver/connect` `{ origin: "<this server's https origin>", label: "<this server's display name>" }` with the person's access token. The first server registered becomes the default; a repeated call relabels and changes nothing else; a `422` carries `errors[]` with pointers `/origin` and `/label`. The client block for this server on the identity provider lists the `integrations` scope. The person's own record of the connection is `GET {issuer}/api/user/integrations`, and `DELETE {issuer}/api/user/integrations/hyperweaver` disconnects; neither is called by this server.
2. Own the deploy preference. For the signed-in person this server answers which target their deploys go to and every other deploy default at its own API, `GET /api/user/deploy` and `PATCH /api/user/deploy`, the write validated by the `deploy` form of this server's `GET /api/rules` (section 7) with the validation contract's `422` and pointers, stored on this server's user row beside the preference columns section 7 already owes. The identity provider's `settings.deploy_target` stopgap is read by nobody once this route answers; tell authorization-server when it does and the member is removed there.
3. Draw the preference on the shared UI's Preferences section on this host, the way mode, theme and language draw there, and hand it to the deploy feature the startcloud-ui session is writing (`universal-deploy.md`, its notifications.md carries the member names).

Not this server's: the `hwa://` link and the agent's own sign-in paths (`../hyperweaver-agent/notifications.md`), and the identity provider's routes above. Deciding source: `../authorization-server-private/src/main/groovy/startcloud/integration/UserIntegrationService.groovy`; `../authorization-server-private/src/main/groovy/startcloud/api/UserIntegrationsApiController.groovy`; `universal-identity.md`, decision 123 and the connected-service decision the startcloud-ui session is adding; `universal-session.md`, Backend session provider.

## 8d. 2026-10-06: the chart feed relayed, the server collecting nothing

The shared UI's charts are one browser store per series fed two ways: a live sample pushed on the one event stream, and history read once and spliced under it. The agents sample and publish (`../hyperweaver-agent/notifications.md` item 1, `../zoneweaver-agent/notifications.md` item 16); this server collects no series of its own.

Required change, within item 2 of section 0:

1. The `monitoring` topic of each agent's stream is relayed on this server's one stream with `agent_id` added to every event's data, as the `tasks` and `hosts` topics are; this server subscribes to an agent's `monitoring` topic only while a browser subscribed to this server's stream has asked for that agent's, so an agent samples for nobody.
2. A proxied `GET /api/agents/{id}/monitoring/*` passes `since` and `until` through unchanged and answers the agent's body unchanged; no count parameter is added or read here.
3. `GET /api/agents/{id}/monitoring/status` is the agent's answer unchanged.

Deciding source: `../startcloud-ui/docs/guides/universal-events.md`, the `monitoring` topic and the relay rule; `universal-navbar.md`, the host overview's The window and The browser's ring.

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
members on `<this origin>/?create=machine&â€¦`.

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
words under `create` on `<this origin>/?create=â€¦`: `machine`, the create
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
