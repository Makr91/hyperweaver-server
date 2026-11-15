/**
 * The agent path of a proxied `/api/agents/{id}/{path}` request, with no
 * leading slash and without a leading `api/`, which the proxy adds itself.
 * @param {import('express').Request} req - The request
 * @returns {string} The agent path
 */
export const agentSubPath = req => {
  const { splat } = req.params;
  const path = Array.isArray(splat) ? splat.join('/') : splat || '';
  return path.startsWith('api/') ? path.slice('api/'.length) : path;
};
