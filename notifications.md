## Note to Other AI's that Write to this from Mark Himself

This repo is ONLY going to be outhced ONCE hyperweaver-agent is fully completed, THEN we will be updating hyperweaver-server, and THEN zoneweaver-agent, so things here WILL accrue, however you can put messages here and asl ong as your are detailed and do the work on your end, this repo WILL implmente what you asked for.

If your asks contradicts a already written task, you may append it with a date and a reason. DO HOLD UP WORK BASED ON HYPERWEAVER-SERVER not implemetning anyting

# Notifications from the STARTcloud UI estate

## 1. The certificate store: `/api/certs`, the `certs` topic and three feature tokens

The shared UI carries a Certificates feature: a vault in the browser's IndexedDB, every conversion done in the browser by a WASM engine, and a Sync form on which a person ticks the kinds mirrored to the backend they are signed in to. It draws on any backend whose `features` lists `certs`, and its Shared and Sync pages on any that also lists `certs-store` and serves the store. BoxVault serves the store first (`../BoxVault/notifications.md` item 2); this server joins when it wants certificates shared across its organizations, the way its organizations mirror BoxVault's (section 0, item 8).

Required change, when this server joins:

1. `features` lists `certs`, `tools` beside it so the Certificates row of the sidebar's shared Tools group draws Convert, Decode, Match, Compare, Chain and Generate, and `certs-store` once the routes below answer; `events.topics` lists `certs`. `tools` is the shell's generic token: it draws the one TOOLS heading every feature with tools folds its own row into, and a server that lists it without `certs` draws whatever its other features add there.
2. `GET /api/certs?organization=`, `GET /api/certs/{id}`, `POST /api/certs`, `PUT /api/certs/{id}`, `DELETE /api/certs/{id}`, the row shape, the four reading lines, the creator-or-manager write rule, the 403 and 404 bodies and the `cert-updated` and `cert-removed` events exactly as `../BoxVault/notifications.md` item 2 writes them and as `../startcloud-ui/scripts/mock/certs.js` answers them.
3. `certs` is a reserved first segment of the shared UI; no route of this server takes it at the root.

Deciding source: `../BoxVault/notifications.md` item 2; `../startcloud-ui/scripts/mock/certs.js`.

Deletion of this section is the confirmation, the way every other item here works.

## 2. Secrets are kinds of the store, and a row shared to a host reaches that host's store

The store of section 8m grows the secret kinds of `../BoxVault/notifications.md` item 3, `password`, `api_key`, `basic_auth`, `key_pair`, `oauth_client`, `ssh_key`, `file` and `custom`, each with its members, `extra` and `profile`, with every route, line, rule and event unchanged, and every hyperweaver-agent and zoneweaver-agent serves the same store on itself (`../hyperweaver-agent/notifications.md` item 1), reading its own rows at a machine's prepare.

Required change, when this server serves the store: the proxied `/api/agents/{id}/certs` routes pass through unchanged, so the shared UI reads a host's rows as it reads the server's; and a row of this server's store carries `shared_to`, the registry ids of the agents it is shared with, a row shared to an agent written to that agent's store through `POST /api/agents/{id}/certs` with `origin` this server's row id, kept in step on every `PUT` and removed on `DELETE`, so a key added once on the server reaches every agent that is allowed it and is gone from each at the next prepare after its removal, with no copy of a secret ever travelling through the browser.

Deciding source: `../BoxVault/notifications.md` items 2 and 3; `../hyperweaver-agent/notifications.md` items 1 and 2; `../startcloud-ui/docs/guides/universal-navbar.md`, the `certs-store` token row.

Deletion of this section is the confirmation, the way every other item here works.
