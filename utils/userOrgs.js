import { getUserOrgAccess } from './orgAccess.js';

/**
 * One membership in the identity provider's shape: the organization's uuid,
 * its name, the role as the one upper-cased entry of `roles` and the primary
 * flag; `display_name`, `logo_url` and `email_hash` null, `personal` false.
 * @param {{uuid: string, name: string|null}} organization - The uuid and name
 * @param {string} role - OWNER, ADMIN or MEMBER
 * @param {boolean} primary - Whether this is the caller's primary organization
 * @returns {{uuid: string, name: string|null, display_name: null, roles: string[], primary: boolean, personal: boolean, logo_url: null, email_hash: null}}
 */
const membershipOf = (organization, role, primary) => ({
  uuid: organization.uuid,
  name: organization.name,
  display_name: null,
  roles: [role],
  primary,
  personal: false,
  logo_url: null,
  email_hash: null,
});

/**
 * The memberships a signed-in person holds, in the identity provider's
 * shape: the OIDC `organizations` claim of the session for a federated
 * sign-in, the user's one local organization otherwise, and every
 * organization for a local super-admin, whose `roles` reads OWNER.
 * @param {Object} user - The user row, its organization association loaded
 * @param {Object} req - The request, `req.session.oidc` and `req.user` resolved
 * @returns {Promise<{organizations: Object[], primaryOrgName: string|null}>} The memberships and the primary organization's name
 */
const resolveUserOrganizations = async (user, req) => {
  const oidc = req.session?.oidc;
  if (oidc && oidc.userId === user.id && Array.isArray(oidc.organizations)) {
    const organizations = oidc.organizations.filter(org => org?.uuid);
    const primary = organizations.find(org => org.primary) || organizations[0] || null;
    return { organizations, primaryOrgName: primary?.name || null };
  }
  const access = await getUserOrgAccess({
    user: { userId: user.id, role: user.role },
    session: req.session,
  });
  const local = user.organization;
  const organizations = [];
  if (local?.org_uuid) {
    const role = access.bypass ? 'OWNER' : access.orgs.get(local.org_uuid) || 'MEMBER';
    organizations.push(membershipOf({ uuid: local.org_uuid, name: local.name }, role, true));
  }
  return { organizations, primaryOrgName: local?.name || null };
};

export { membershipOf, resolveUserOrganizations };
