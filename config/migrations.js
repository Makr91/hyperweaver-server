/**
 * The ordered configuration migrations, one entry per schema version above 1:
 * `{ version, migrate(name, file) }`, where `migrate` receives the file name
 * (`app`, `auth`, `db`, `mail`) and the plain file object and returns the
 * migrated object with only the keys it changes touched. `postinst` on
 * Debian and `startup.sh` on OmniOS run every entry whose version is above
 * the file's `schemaVersion`, in order, and stamp the schema's version.
 */
const migrations = [];

export default migrations;
