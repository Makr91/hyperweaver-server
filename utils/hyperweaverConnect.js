import axios from 'axios';
import { loadConfig, getOrigin } from './config-loader.js';
import { log } from './Logger.js';

const CONNECT_PATH = '/api/user/integrations/hyperweaver/connect';

/**
 * Attach this server to the person's `hyperweaver` connected service at the
 * identity provider: `POST {issuer}/api/user/integrations/hyperweaver/connect`
 * with this server's origin and its datacenter label, on the person's own
 * access token. A refusal or an unreachable provider is logged and never
 * fails the sign-in.
 * @param {{provider: string, accessToken: string, hostname: string}} session - The provider's name, the person's access token and the request's hostname
 * @returns {Promise<void>}
 */
const connectHyperweaver = async ({ provider, accessToken, hostname }) => {
  try {
    const issuer = loadConfig('auth').auth.oidc.providers[provider]?.issuer;
    if (!issuer || !accessToken) {
      return;
    }
    await axios.post(
      `${new URL(issuer).origin}${CONNECT_PATH}`,
      {
        origin: new URL(getOrigin(hostname)).origin,
        label: loadConfig('app').branding.datacenter_label,
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  } catch (error) {
    log.auth.warn('Hyperweaver connection could not be registered', {
      provider,
      status: error.response?.status,
      error: error.message,
    });
  }
};

export { connectHyperweaver };
