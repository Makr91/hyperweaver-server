import { randomBytes } from 'crypto';
import db from '../../../models/index.js';
import { log } from '../../../utils/Logger.js';
import { problem, refuse } from '../../../utils/problem.js';
import { holdsGlobalAdmin, resolveOrgMembership } from '../../../utils/orgMembership.js';
import { resolveEmailLanguage } from '../../../utils/userLanguage.js';
import { sendInvitationMail } from '../../mail/invitation.js';

const { organization: Organization, invitation: Invitation, user: User } = db;

const RETRY_AFTER_SECONDS = '60';
const DEFAULT_DAYS = 7;
const MIN_DAYS = 1;
const MAX_DAYS = 30;
const MANAGING_ROLES = ['admin', 'owner'];

const refused = (req, res, status, type, key) =>
  problem(res, req, { status, type, title: req.__(key) });

const managesOrganization = async (req, organizationId) => {
  const user = await User.findByPk(req.userId);
  if (user && (await holdsGlobalAdmin(user))) {
    return true;
  }
  const membership = await resolveOrgMembership(req, organizationId);
  return Boolean(membership && MANAGING_ROLES.includes(membership.role));
};

/**
 * @swagger
 * /api/invitations/{id}/resend:
 *   post:
 *     summary: Resend a pending invitation with a new token and expiry
 *     description: Gives a pending local invitation a new token and an expiry of expiration_days from now, and mails it again. For an owner or admin of the invitation's organization, or a global admin. An invitation of an organization the identity provider manages is refused.
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expiration_days:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 30
 *                 default: 7
 *     responses:
 *       200:
 *         description: Invitation resent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 invitation_token_expires:
 *                   type: integer
 *                 invitation_link:
 *                   type: string
 *       403:
 *         description: The caller does not manage the organization, or the identity provider manages it
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 *       404:
 *         description: No pending invitation of that id
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 *       422:
 *         description: expiration_days is outside 1 to 30
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 *       503:
 *         description: The mail could not be sent; Retry-After names when to try again
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 */
export const resendInvitation = async (req, res) => {
  const days = req.body?.expiration_days ?? DEFAULT_DAYS;

  try {
    if (!Number.isInteger(days) || days < MIN_DAYS) {
      return refuse(res, req, [
        { pointer: '/expiration_days', rule: 'minimum', params: { minimum: MIN_DAYS } },
      ]);
    }
    if (days > MAX_DAYS) {
      return refuse(res, req, [
        { pointer: '/expiration_days', rule: 'maximum', params: { maximum: MAX_DAYS } },
      ]);
    }

    const invitation = await Invitation.findByPk(Number.parseInt(req.params.id, 10));
    if (!invitation || invitation.accepted) {
      return refused(req, res, 404, 'not-found', 'invitations.notFound');
    }
    const organization = await Organization.findByPk(invitation.organizationId);
    if (!organization) {
      return refused(req, res, 404, 'not-found', 'organizations.organizationNotFound');
    }
    if (!(await managesOrganization(req, organization.id))) {
      return refused(req, res, 403, 'forbidden', 'organizations.requireAdminOrOwner');
    }
    if (organization.external_issuer) {
      return refused(req, res, 403, 'forbidden', 'organizations.externallyManaged');
    }

    const expires = Date.now() + days * 24 * 60 * 60 * 1000;
    await invitation.update({
      token: randomBytes(20).toString('hex'),
      expires,
      expired: false,
      invited_by: req.userId,
    });

    try {
      const invitationLink = await sendInvitationMail(
        invitation.email,
        invitation.token,
        organization.name,
        expires,
        await resolveEmailLanguage(invitation.email, organization)
      );
      return res.status(200).send({
        message: req.__('invitations.resent'),
        invitation_token_expires: expires,
        invitation_link: invitationLink,
      });
    } catch (mailError) {
      log.error.error('Failed to resend invitation mail:', mailError);
      res.set('Retry-After', RETRY_AFTER_SECONDS);
      return problem(res, req, {
        status: 503,
        type: 'send-failed',
        title: req.__('mail.errorSendingEmail'),
      });
    }
  } catch (err) {
    log.error.error('Failed to resend invitation:', err);
    return problem(res, req, {
      status: 500,
      type: 'internal',
      title: req.__('invitations.resend.error'),
    });
  }
};
