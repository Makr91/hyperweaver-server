import { log } from '../../utils/Logger.js';
import { problem } from '../../utils/problem.js';
import db from '../../models/index.js';

const { organization: Organization, invitation: Invitation, UserOrg } = db;

const MANAGING_ROLES = ['admin', 'owner'];

const invitationCounts = invitations => {
  const now = Date.now();
  const accepted = invitations.filter(invitation => invitation.accepted).length;
  const expired = invitations.filter(
    invitation =>
      !invitation.accepted && (invitation.expired || new Date(invitation.expires).getTime() < now)
  ).length;
  return {
    total: invitations.length,
    pending: invitations.length - accepted - expired,
    accepted,
    expired,
  };
};

/**
 * @swagger
 * /api/organization/{organizationName}/stats:
 *   get:
 *     summary: The member and invitation counts of an organization
 *     description: Counts the organization's members, the ones not suspended, its owners and admins, and its invitations by state. For an owner or admin of the organization, or a global admin.
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationName
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The counts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_users:
 *                   type: integer
 *                 active_users:
 *                   type: integer
 *                 admin_users:
 *                   type: integer
 *                 invitations:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     pending:
 *                       type: integer
 *                     accepted:
 *                       type: integer
 *                     expired:
 *                       type: integer
 *       403:
 *         description: The caller does not manage the organization
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 *       404:
 *         description: Organization not found
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 */
export const getOrganizationStats = async (req, res) => {
  try {
    const memberships = await UserOrg.getOrganizationUsers(req.organizationId);
    const invitations = await Invitation.findAll({
      where: { organizationId: req.organizationId },
    });
    return res.status(200).send({
      total_users: memberships.length,
      active_users: memberships.filter(membership => !membership.user?.suspended).length,
      admin_users: memberships.filter(membership => MANAGING_ROLES.includes(membership.role))
        .length,
      invitations: invitationCounts(invitations),
    });
  } catch (err) {
    log.error.error('Error reading organization stats:', err);
    return problem(res, req, {
      status: 500,
      type: 'internal',
      title: req.__('organizations.statsError'),
    });
  }
};

/**
 * @swagger
 * /api/organizations:
 *   get:
 *     summary: Every organization of this server, for assignment
 *     description: Answers each organization's id, name, display name, base domain and its uuid as org_uuid, the identity a host or a machine is assigned by, ordered by name. Global admins only.
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The organizations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 organizations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       display_name:
 *                         type: string
 *                         nullable: true
 *                       org_uuid:
 *                         type: string
 *                       base_domain:
 *                         type: string
 *                         nullable: true
 *       403:
 *         description: The caller is not a global admin
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 */
export const listOrganizations = async (req, res) => {
  try {
    const organizations = await Organization.findAll({
      attributes: ['id', 'name', 'display_name', 'uuid', 'base_domain'],
      order: [['name', 'ASC']],
    });
    return res.status(200).send({
      success: true,
      organizations: organizations.map(organization => ({
        id: organization.id,
        name: organization.name,
        display_name: organization.display_name || null,
        org_uuid: organization.uuid,
        base_domain: organization.base_domain || null,
      })),
    });
  } catch (err) {
    log.error.error('Error listing organizations:', err);
    return problem(res, req, {
      status: 500,
      type: 'internal',
      title: req.__('organizations.findAllError'),
    });
  }
};

/**
 * @swagger
 * /api/organizations/check/{name}:
 *   get:
 *     summary: Whether an organization name is taken (public)
 *     description: Answers whether an organization of that name exists, without regard to letter case.
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The answer
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *                 organization_name:
 *                   type: string
 *                   nullable: true
 */
export const checkOrganizationExists = async (req, res) => {
  try {
    const organization = await Organization.findOne({
      where: { name: req.params.name },
      attributes: ['name'],
    });
    return res.status(200).send({
      exists: Boolean(organization),
      organization_name: organization?.name || null,
    });
  } catch (err) {
    log.error.error('Error checking organization name:', err);
    return problem(res, req, {
      status: 500,
      type: 'internal',
      title: req.__('organizations.checkError'),
    });
  }
};
