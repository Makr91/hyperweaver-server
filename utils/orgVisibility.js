/**
 * @fileoverview Org visibility + assignment-management checks built on the orgAccess
 * layer (D15): registry-list filtering and the self-service rules for who may edit an
 * agent's or a machine's org assignment.
 */

import db from '../models/index.js';
import {
  getUserOrgAccess,
  resolveAgentAccess,
  isManagerRole,
  machineIdentifier,
} from './orgAccess.js';

const { serverOrg: ServerOrgModel, machineOrg: MachineOrgModel } = db;

/**
 * Filter the registry list to the agents this user may SEE (org membership on the agent
 * or a machine sticker on that agent; an agent no org owns is seen by a global admin
 * alone) and annotate every visible row with `org_uuids` (the agent's owning orgs, `[]` =
 * unassigned). Privacy: a global admin and an owner or admin of any organization
 * get the full owning-org list; everyone else sees only the intersection with their OWN
 * orgs — foreign org uuids on shared hosts never leak (D15).
 * @param {import('express').Request} req
 * @param {Array<Object>} servers - servers rows
 * @returns {Promise<Array<Object>>} Visible subset as plain objects with org_uuids
 */
export const filterAndAnnotateServers = async (req, servers) => {
  const userAccess = await getUserOrgAccess(req);
  const orgUuids = [...userAccess.orgs.keys()];

  const [allAgentOrgRows, machineOrgRows] = await Promise.all([
    ServerOrgModel.findAll({ where: {} }),
    !userAccess.bypass && orgUuids.length > 0
      ? MachineOrgModel.findAll({ where: { org_uuid: orgUuids } })
      : [],
  ]);

  const ownedServers = new Map();
  for (const row of allAgentOrgRows) {
    if (!ownedServers.has(row.server_id)) {
      ownedServers.set(row.server_id, new Set());
    }
    ownedServers.get(row.server_id).add(row.org_uuid);
  }

  const machineVisible = new Set(machineOrgRows.map(row => row.server_id));

  const visible =
    userAccess.bypass === true
      ? servers
      : servers.filter(server => {
          const owners = ownedServers.get(server.id);
          if (!owners) {
            return machineVisible.has(server.id);
          }
          if (machineVisible.has(server.id)) {
            return true;
          }
          return orgUuids.some(uuid => owners.has(uuid));
        });

  const fullLists = userAccess.privileged;
  return visible.map(server => {
    const owners = [...(ownedServers.get(server.id) ?? [])];
    return {
      ...server.toJSON(),
      org_uuids: fullLists ? owners : owners.filter(uuid => userAccess.orgs.has(uuid)),
    };
  });
};

/**
 * Decorate a proxied GET machines list with each machine's `org_uuids` from
 * machine_orgs (`[]` = unassigned). Same privacy rule as the registry annotation:
 * full lists for a global admin and an owner or admin of any organization,
 * caller's-orgs intersection otherwise.
 * @param {import('express').Request} req
 * @param {number} serverId
 * @param {*} data - Agent machines-list response body ({machines, total} or array)
 * @returns {Promise<*>} Decorated body (same shape)
 */
export const decorateMachinesResponse = async (req, serverId, data) => {
  const rows = await MachineOrgModel.findForServer(serverId);
  const byMachine = new Map();
  for (const row of rows) {
    if (!byMachine.has(row.machine_name)) {
      byMachine.set(row.machine_name, []);
    }
    byMachine.get(row.machine_name).push(row.org_uuid);
  }

  const fullLists = (await getUserOrgAccess(req)).privileged;
  const userOrgs = req.orgAccess?.userOrgs ?? new Map();
  const decorate = item => {
    const name = machineIdentifier(item);
    const owners = (name !== null && byMachine.get(name)) || [];
    return {
      ...item,
      org_uuids: fullLists ? owners : owners.filter(uuid => userOrgs.has(uuid)),
    };
  };

  if (Array.isArray(data)) {
    return data.map(decorate);
  }
  if (data && Array.isArray(data.machines)) {
    return { ...data, machines: data.machines.map(decorate) };
  }
  return data;
};

/**
 * May this user manage org assignment on an agent? A global admin always; otherwise an
 * owner or admin of an organization that owns the agent.
 * @param {import('express').Request} req
 * @param {number} serverId
 * @returns {Promise<boolean>}
 */
export const canManageAgentOrgs = async (req, serverId) => {
  const access = await resolveAgentAccess(req, serverId);
  return access.level === 'full' && isManagerRole(access.role);
};

/**
 * May this user manage org assignment on a machine? Agent-org managers may assign ANY
 * machine on their agent (unstickered included); machine-org managers may re-assign
 * their own machine; a global admin always.
 * @param {import('express').Request} req
 * @param {number} serverId
 * @param {string} machineName
 * @returns {Promise<boolean>}
 */
export const canManageMachineOrgs = async (req, serverId, machineName) => {
  const access = await resolveAgentAccess(req, serverId);
  if (access.level === 'full' && isManagerRole(access.role)) {
    return true;
  }
  if (access.level === 'vm') {
    return isManagerRole(access.machines.get(machineName));
  }
  return false;
};
