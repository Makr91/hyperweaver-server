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
never cited. Every item below is open
work for this repository; an item is deleted when it is done.
Read every file named below in full before acting on any of it.

## 5. Rulings that bind this repository

Why: each ruling is one value every UI backend in the estate agrees on,
and a UI backend that keeps its own breaks the shared UI and the shared
docs for all of them.

- Request bodies are `snake_case`; the status payload's own members
  (`logoUrl`, `baseUrl`, `reqType`, `fallbackCustomerId`) are the one
  named exception. `controllers/servers/registry.js` reads
  `entityName`, `apiKey`, `allowInsecure`;
  `controllers/RegistrationController.js` reads `confirmPassword`,
  `organizationName`, `inviteCode`. Required change: every body member
  renamed with the UI adapter in the same release. Deciding source:
  `universal-validation.md:145-153`; `universal-identity.md:239-243`;
  `priorities.yaml:186`.

## 7. Code gaps against the contracts

Why: the shared UI reads nothing but the contract surfaces, so every gap
below is a page it cannot draw or a write it cannot explain on this UI
backend.

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
- `../startcloud-ui/README.md`: Hosting the UI
- `../hyperweaver-ui/notifications.md`: the UI side of the same rule and
  the feature-first tree
