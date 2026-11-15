import { Router } from 'express';
import { authJwt, oidcTokenRefresh } from '../middleware/index.js';
import ServerController from '../controllers/ServerController.js';
import { orgAuthorizeAgent, requireOrgManager } from '../utils/orgAccess.js';
import { agentSubPath } from '../utils/agentPath.js';
import {
  getServerOrgs,
  setServerOrgs,
  getMachineOrgs,
  setMachineOrgs,
} from '../controllers/OrgAccessController.js';
import { proxyToBoxVault } from '../controllers/BoxVaultController.js';
import { adminLimiter, apiProxyLimiter } from './limiters.js';

const router = Router();

const signedIn = [oidcTokenRefresh, authJwt.verifyToken, authJwt.isUser];

router.post('/servers', adminLimiter, signedIn, authJwt.isAdmin, ServerController.addServer);
router.get('/servers', adminLimiter, signedIn, ServerController.getAllServers);
router.post('/servers/test', adminLimiter, signedIn, ServerController.testServer);
router.patch(
  '/servers/:serverId',
  adminLimiter,
  signedIn,
  authJwt.isAdmin,
  ServerController.updateServer
);
router.delete(
  '/servers/:serverId',
  adminLimiter,
  signedIn,
  authJwt.isAdmin,
  ServerController.removeServer
);

router.get('/servers/:serverId/orgs', adminLimiter, signedIn, getServerOrgs);
router.put('/servers/:serverId/orgs', adminLimiter, signedIn, setServerOrgs);
router.get('/servers/:serverId/machines/:machineName/orgs', adminLimiter, signedIn, getMachineOrgs);
router.put('/servers/:serverId/machines/:machineName/orgs', adminLimiter, signedIn, setMachineOrgs);

router.all('/boxvault/*splat', apiProxyLimiter, signedIn, proxyToBoxVault);

const AGENT_SUPERADMIN_PREFIXES = ['settings', 'server/restart'];
const AGENT_ADMIN_PREFIXES = [
  'system/zfs/arc',
  'system/fault-management',
  'system/logs',
  'system/syslog',
  'system/host/shutdown',
  'system/host/restart',
  'system/host/poweroff',
  'system/host/halt',
  'system/hosts',
  'database',
];

const matchesAgentPrefix = (subPath, prefix) =>
  subPath === prefix || subPath.startsWith(`${prefix}/`);

/**
 * Gate the sensitive agent surfaces before the proxy runs: settings and
 * restart to a global admin, host power, logs, ZFS ARC, fault management,
 * hosts file and database maintenance to a global admin or an owner or
 * admin of any organization; every other sub-path passes.
 */
const authorizeAgentSubPath = (req, res, next) => {
  const subPath = agentSubPath(req);

  if (AGENT_SUPERADMIN_PREFIXES.some(prefix => matchesAgentPrefix(subPath, prefix))) {
    return authJwt.isAdmin(req, res, next);
  }
  if (AGENT_ADMIN_PREFIXES.some(prefix => matchesAgentPrefix(subPath, prefix))) {
    return requireOrgManager(req, res, next);
  }
  return next();
};

router.all(
  '/agents/:id/*splat',
  apiProxyLimiter,
  signedIn,
  authorizeAgentSubPath,
  orgAuthorizeAgent,
  ServerController.proxyToAgent
);

export default router;
