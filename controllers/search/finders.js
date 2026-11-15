import db from '../../models/index.js';
import { log } from '../../utils/Logger.js';
import {
  resolveAgentAccess,
  filterProxyResponse,
  machineIdentifier,
  isManagerRole,
} from '../../utils/orgAccess.js';
import { filterAndAnnotateServers } from '../../utils/orgVisibility.js';
import { tokenClauses, matchedChain } from './scope.js';

const { server: ServerModel, user: User, organization: Organization, UserOrg } = db;

const HOST_FIELDS = ['entity_name', 'hostname', 'description'];
const USER_FIELDS = ['username', 'email', 'name'];
const ORGANIZATION_FIELDS = ['name', 'description', 'org_code'];

/**
 * The chain entries of a row's own fields, in match priority order.
 * @param {Object} record - The row
 * @param {string[]} fields - Field names
 * @returns {Array<[string, *]>} The entries
 */
const own = (record, fields) => fields.map(field => [field, record[field]]);

const joinParts = (...parts) => parts.filter(Boolean).join(' · ');

/**
 * One result row before its score: the locator members of the family's
 * shape, the subtitle the plain-text chain above the hit, the highlight
 * carrying the matched field's text with no spans yet.
 * @param {Object} fields - kind, id, org, name, anchor, title, subtitle, facets, and matched from matchedChain
 * @returns {Object} The row
 */
const row = ({ kind, id, org = '', name, anchor = '', title, subtitle, facets = {}, matched }) => ({
  kind,
  id,
  collection: null,
  org,
  name,
  version: '',
  provider: '',
  architecture: '',
  anchor,
  source: null,
  title,
  subtitle,
  matched: matched.field,
  highlight: { [matched.field]: { text: matched.text, spans: [] } },
  facets,
});

const visibleServers = async req => {
  const servers = await ServerModel.getAllServers();
  return filterAndAnnotateServers(req, servers);
};

const findHosts = async ({ req, tokens }) => {
  const servers = await visibleServers(req);
  return servers.flatMap(server => {
    const matched = matchedChain(own(server, HOST_FIELDS), tokens);
    if (!matched) {
      return [];
    }
    const role = server.capabilities?.role || '';
    return [
      row({
        kind: 'host',
        id: String(server.id),
        name: server.entity_name,
        anchor: String(server.id),
        title: server.entity_name,
        subtitle: joinParts(`${server.hostname}:${server.port}`, role),
        facets: { role, active: String(Boolean(server.is_active)) },
        matched,
      }),
    ];
  });
};

const machinesOf = async (req, server) => {
  const agent = await ServerModel.scope('withApiKey').findByPk(server.id);
  if (!agent?.api_key || !agent.isAgentRole()) {
    return [];
  }
  const access = await resolveAgentAccess(req, server.id);
  if (access.level === 'none') {
    return [];
  }
  const result = await agent.makeRequest('machines', { method: 'GET' });
  if (!result.success) {
    log.proxy.warn('search: list machines failed', { id: server.id, error: result.error });
    return [];
  }
  const scoped = { orgAccess: { ...access, filterMachines: access.level === 'vm' } };
  const body = filterProxyResponse(scoped, result.data);
  const machines = Array.isArray(body) ? body : body?.machines || [];
  return machines.map(machine => ({ machine, server }));
};

const findMachines = async ({ req, tokens }) => {
  const servers = await visibleServers(req);
  const lists = await Promise.all(servers.map(server => machinesOf(req, server)));
  return lists.flat().flatMap(({ machine, server }) => {
    const name = machineIdentifier(machine) ?? '';
    const tags = Array.isArray(machine.tags) ? machine.tags.join(' ') : '';
    const matched = matchedChain(
      [
        ['name', name],
        ['notes', machine.notes ?? ''],
        ['tags', tags],
      ],
      tokens
    );
    if (!matched) {
      return [];
    }
    const status = machine.status ?? '';
    return [
      row({
        kind: 'machine',
        id: `${server.id}/${name}`,
        name,
        anchor: String(server.id),
        title: name,
        subtitle: joinParts(server.entity_name, machine.hypervisor ?? '', status),
        facets: { status, host: server.entity_name },
        matched,
      }),
    ];
  });
};

const userRow = (user, organizationName, tokens) => {
  const matched = matchedChain(own(user, USER_FIELDS), tokens);
  if (!matched) {
    return [];
  }
  return [
    row({
      kind: 'user',
      id: user.username,
      org: organizationName,
      name: user.username,
      title: user.username,
      subtitle: organizationName,
      matched,
    }),
  ];
};

const managedUuids = access =>
  [...access.orgs.entries()].filter(([, role]) => isManagerRole(role)).map(([uuid]) => uuid);

const findUsers = async ({ tokens, access, isAdmin }) => {
  const where = tokenClauses(USER_FIELDS, tokens);
  if (isAdmin) {
    const users = await User.findAll({
      where,
      include: [{ model: Organization, as: 'primaryOrganization', attributes: ['name'] }],
      order: [['username', 'ASC']],
    });
    return users.flatMap(user => userRow(user, user.primaryOrganization?.name || '', tokens));
  }
  const uuids = managedUuids(access);
  if (uuids.length === 0) {
    return [];
  }
  const memberships = await UserOrg.findAll({
    include: [
      { model: User, as: 'user', where, required: true },
      {
        model: Organization,
        as: 'organization',
        where: { uuid: uuids },
        required: true,
        attributes: ['name'],
      },
    ],
  });
  return memberships.flatMap(membership =>
    userRow(membership.user, membership.organization.name, tokens)
  );
};

const findOrganizations = async ({ tokens, access, isAdmin }) => {
  const organizations = await Organization.findAll({
    where: tokenClauses(ORGANIZATION_FIELDS, tokens),
    order: [['name', 'ASC']],
  });
  const reachable = organization => isAdmin || access.orgs.has(organization.uuid);
  return organizations.filter(reachable).flatMap(organization => {
    const matched = matchedChain(own(organization, ORGANIZATION_FIELDS), tokens);
    if (!matched) {
      return [];
    }
    return [
      row({
        kind: 'organization',
        id: organization.name,
        org: organization.name,
        name: organization.name,
        title: organization.name,
        subtitle: organization.description || '',
        matched,
      }),
    ];
  });
};

/**
 * One finder per kind, each answering the rows the caller could already
 * list: hosts from the registry the person may see, machines from each
 * visible agent's machine list under the person's organization filter,
 * users within an administrator's reach, organizations the person belongs
 * to, every one for an administrator.
 */
const FINDERS = {
  host: findHosts,
  machine: findMachines,
  user: findUsers,
  organization: findOrganizations,
};

export { FINDERS };
