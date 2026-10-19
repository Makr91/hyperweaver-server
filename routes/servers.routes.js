import { Router } from 'express';
import { authenticate, requireAdmin, requireSuperAdmin } from '../auth/auth.js';
import { oidcTokenRefresh } from '../auth/oidcTokenRefresh.js';
import ServerController from '../controllers/ServerController.js';
import { orgAuthorizeAgent } from '../utils/orgAccess.js';
import {
  getServerOrgs,
  setServerOrgs,
  getMachineOrgs,
  setMachineOrgs,
} from '../controllers/OrgAccessController.js';
import { proxyToBoxVault } from '../controllers/BoxVaultController.js';
import { adminLimiter, apiProxyLimiter } from './limiters.js';

const router = Router();

router.post('/servers', adminLimiter, authenticate, requireAdmin, ServerController.addServer);
router.get(
  '/servers',
  adminLimiter,
  authenticate,
  oidcTokenRefresh,
  ServerController.getAllServers
);
router.post('/servers/test', adminLimiter, authenticate, ServerController.testServer);
router.patch(
  '/servers/:serverId',
  adminLimiter,
  authenticate,
  requireAdmin,
  ServerController.updateServer
);
router.delete(
  '/servers/:serverId',
  adminLimiter,
  authenticate,
  requireAdmin,
  ServerController.removeServer
);

router.get('/servers/:serverId/orgs', adminLimiter, authenticate, oidcTokenRefresh, getServerOrgs);
router.put('/servers/:serverId/orgs', adminLimiter, authenticate, oidcTokenRefresh, setServerOrgs);
router.get(
  '/servers/:serverId/machines/:machineName/orgs',
  adminLimiter,
  authenticate,
  oidcTokenRefresh,
  getMachineOrgs
);
router.put(
  '/servers/:serverId/machines/:machineName/orgs',
  adminLimiter,
  authenticate,
  oidcTokenRefresh,
  setMachineOrgs
);

router.all('/boxvault/*splat', apiProxyLimiter, authenticate, oidcTokenRefresh, proxyToBoxVault);

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
 * Gate the sensitive agent surfaces by this server's own roles before the
 * proxy runs: settings and restart to the super-admin, host power, logs,
 * ZFS ARC, fault management, hosts file and database maintenance to an
 * admin; every other sub-path passes.
 */
const authorizeAgentSubPath = (req, res, next) => {
  const subPath = Array.isArray(req.params.splat)
    ? req.params.splat.join('/')
    : req.params.splat || '';

  if (AGENT_SUPERADMIN_PREFIXES.some(prefix => matchesAgentPrefix(subPath, prefix))) {
    return requireSuperAdmin(req, res, next);
  }
  if (AGENT_ADMIN_PREFIXES.some(prefix => matchesAgentPrefix(subPath, prefix))) {
    return requireAdmin(req, res, next);
  }
  return next();
};

router.all(
  '/agents/:id/*splat',
  apiProxyLimiter,
  authenticate,
  oidcTokenRefresh,
  authorizeAgentSubPath,
  orgAuthorizeAgent,
  ServerController.proxyToAgent
);

export default router;
