import { loadConfig } from '../../utils/config.js';
import { log } from '../../utils/Logger.js';

const config = loadConfig();

/**
 * @swagger
 * /api/auth/methods:
 *   get:
 *     summary: Get available authentication methods (Public)
 *     description: Retrieve list of enabled authentication methods for the login form
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Authentication methods retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 methods:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: Method identifier
 *                         example: "ldap"
 *                       name:
 *                         type: string
 *                         description: Human-readable method name
 *                         example: "LDAP - somedomain.com"
 *                       enabled:
 *                         type: boolean
 *                         description: Whether method is enabled
 *                         example: true
 *                   example:
 *                     - id: "local"
 *                       name: "Local Account"
 *                       enabled: true
 *                     - id: "ldap"
 *                       name: "LDAP - somedomain.com"
 *                       enabled: true
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
/**
 * Lists the enabled auth methods for the login form. local_registration_enabled tells
 * the UI whether to show the local self-service /register form; when false, the UI
 * routes "Register" to the identity provider (?register → prompt=create).
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getAuthMethods = (req, res) => {
  try {
    void req;
    const methods = [];

    if (config.authentication?.local_enabled !== false) {
      methods.push({
        id: 'local',
        name: 'Local Account',
        enabled: true,
      });
    }

    if (config.authentication?.ldap_enabled === true) {
      let ldapDisplayName = 'LDAP Directory';
      try {
        const ldapUrl = config.authentication.ldap_url;
        if (ldapUrl) {
          const urlMatch = ldapUrl.match(/^ldaps?:\/\/(?<host>[^:/]+)/i);
          if (urlMatch) {
            const { host: hostname } = urlMatch.groups;
            const domainParts = hostname.split('.');
            if (domainParts.length >= 2) {
              const domain = domainParts.slice(-2).join('.');
              ldapDisplayName = `LDAP - ${domain}`;
            } else {
              ldapDisplayName = `LDAP - ${hostname}`;
            }
          }
        }
      } catch (error) {
        log.auth.error('Error parsing LDAP URL for display name', { error: error.message });
      }

      methods.push({
        id: 'ldap',
        name: ldapDisplayName,
        enabled: true,
      });
    }

    try {
      const oidcProvidersConfig = config.authentication?.oidc_providers || {};

      Object.entries(oidcProvidersConfig).forEach(([providerName, providerConfig]) => {
        if (providerConfig.enabled && providerConfig.display_name) {
          methods.push({
            id: `oidc-${providerName}`,
            name: providerConfig.display_name,
            enabled: true,
          });
        }
      });
    } catch (error) {
      log.auth.error('Error processing OIDC providers for auth methods', {
        error: error.message,
      });
    }

    res.json({
      success: true,
      methods,
      local_registration_enabled: config.authentication?.local_registration_enabled !== false,
    });
  } catch (error) {
    log.auth.error('Get auth methods error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
