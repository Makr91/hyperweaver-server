import { CONFIG_NAMES, loadConfig as loadFile } from './config-loader.js';

/**
 * The filled documents of every configuration file merged into one object,
 * so a reader asks for `config.authentication.jwt_secret` without naming
 * the file the key lives in.
 * @returns {Object} The merged configuration
 */
export const loadConfig = () => Object.assign({}, ...CONFIG_NAMES.map(name => loadFile(name)));

export { loadFile };
