const MANAGER_ROLES = ['OWNER', 'ADMIN'];

/**
 * The one role word the shared UI's hosts pages read: `super-admin` for a
 * global admin, `admin` for an owner or admin of any organization, `user`
 * otherwise.
 * @param {string[]} authorities - The global roles as answered, `ROLE_ADMIN` among them
 * @param {Array<{roles?: string[]}>} organizations - The memberships in the identity provider's shape
 * @returns {string} `super-admin`, `admin` or `user`
 */
const hostRoleOf = (authorities, organizations) => {
  if (authorities.includes('ROLE_ADMIN')) {
    return 'super-admin';
  }
  const manages = organizations.some(membership =>
    (membership.roles || []).some(role => MANAGER_ROLES.includes(role))
  );
  return manages ? 'admin' : 'user';
};

export { hostRoleOf };
