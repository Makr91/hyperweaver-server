import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadConfig } from './config-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCHEMA = 'https://json-schema.org/draft/2020-12/schema';

const FORMS = [
  'login',
  'register',
  'displayName',
  'profile',
  'password',
  'email',
  'organization',
  'invitation',
];

const readRule = name => JSON.parse(readFileSync(join(__dirname, `../rules/${name}.json`), 'utf8'));

const DEFS = readRule('defs');
const FORM_RULES = Object.fromEntries(FORMS.map(name => [name, readRule(name)]));

const withProperty = (form, name, extra) => ({
  ...form,
  properties: { ...form.properties, [name]: { ...form.properties[name], ...extra } },
});

/**
 * The host's password minimum, `authentication.local_password_min_length`.
 * @returns {number}
 */
const getPasswordMinLength = () => loadConfig('auth').authentication.local_password_min_length;

/**
 * The rules document `GET /api/rules` answers and every write route evaluates:
 * the estate's `$defs` and one object schema per form, the password minimum
 * read from the auth configuration.
 * @returns {{ $schema: string, $defs: Object, forms: Object }}
 */
const getRulesDocument = () => {
  const minLength = getPasswordMinLength();
  return {
    $schema: SCHEMA,
    $defs: DEFS,
    forms: {
      ...FORM_RULES,
      register: withProperty(FORM_RULES.register, 'password', { minLength }),
      password: withProperty(FORM_RULES.password, 'password', { minLength }),
    },
  };
};

export { getRulesDocument, getPasswordMinLength };
