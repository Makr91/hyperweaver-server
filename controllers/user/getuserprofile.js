import { createHash } from 'crypto';
import { resolveUserOrganizations } from '../../utils/userOrgs.js';
import { log } from '../../utils/Logger.js';
import { problem } from '../../utils/problem.js';
import db from '../../models/index.js';
const { user: User } = db;

const emailHashOf = email =>
  createHash('sha256')
    .update(
      String(email || '')
        .trim()
        .toLowerCase()
    )
    .digest('hex');

/**
 * The profile `GET /api/user` and the sign-in answers carry: the shared
 * UI's `backend` session shape over this server's user row.
 * @param {Object} user - The user row, its organization association loaded
 * @param {Object} req - The request, its session carrying the OIDC stash
 * @returns {Promise<Object>} The profile
 */
export const profileOf = async (user, req) => {
  const { organizations, primaryOrgName } = await resolveUserOrganizations(user, req);
  return {
    id: user.id,
    username: user.username,
    name: user.name || null,
    preferred_language: user.preferred_language || null,
    preferred_mode: user.preferred_mode || null,
    preferred_theme: user.preferred_theme || null,
    preferred_motion: user.preferred_motion || null,
    email: user.email,
    verified: true,
    email_hash: emailHashOf(user.email),
    avatar_url: user.avatar_url || null,
    roles: [`ROLE_${String(user.role).toUpperCase().replace('-', '_')}`],
    organization: primaryOrgName,
    organizations,
    entitlements: [],
  };
};

/**
 * @swagger
 * /api/user:
 *   get:
 *     summary: Get current user profile
 *     description: Retrieve the profile information of the currently authenticated user. The answer carries no credential; the session renews through POST /api/auth/refresh-token. It is sent with Cache-Control no-store and an ETag of the body, and a request whose If-None-Match names that tag is answered 304 with no body.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: If-None-Match
 *         schema:
 *           type: string
 *         description: The ETag of the profile last read; a match answers 304
 *     responses:
 *       304:
 *         description: The profile is unchanged since the ETag named
 *       200:
 *         description: User profile retrieved successfully
 *         headers:
 *           ETag:
 *             schema:
 *               type: string
 *             description: The tag of this body, to send back as If-None-Match
 *           Cache-Control:
 *             schema:
 *               type: string
 *             example: no-store
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: User ID
 *                 username:
 *                   type: string
 *                   description: Username
 *                 email:
 *                   type: string
 *                   format: email
 *                   description: User email
 *                 verified:
 *                   type: boolean
 *                   description: Email verification status
 *                 email_hash:
 *                   type: string
 *                   description: Hashed email for Gravatar
 *                 preferred_language:
 *                   type: string
 *                   nullable: true
 *                 preferred_mode:
 *                   type: string
 *                   nullable: true
 *                   enum: [light, dark, auto]
 *                   description: The mode the person chose, copied from the identity provider's preferences.mode at sign-in for a federated account; null follows the operating system
 *                 preferred_theme:
 *                   type: string
 *                   nullable: true
 *                   description: The bare theme name the person chose, copied from the identity provider's preferences.theme at sign-in for a federated account
 *                 preferred_motion:
 *                   type: string
 *                   nullable: true
 *                   enum: [auto, reduce]
 *                   description: The person's reduced-motion switch, copied from the identity provider's preferences.motion at sign-in for a federated account
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: User roles
 *                 organization:
 *                   type: string
 *                   description: Organization name
 *                 organizations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Membership'
 *                   description: Every membership in the identity provider's shape
 *                 avatar_url:
 *                   type: string
 *                   nullable: true
 *                   description: Stored avatar URL from the identity provider (clients fall back to the email_hash gravatar)
 *                 given_name:
 *                   type: string
 *                   nullable: true
 *                 family_name:
 *                   type: string
 *                   nullable: true
 *                 middle_name:
 *                   type: string
 *                   nullable: true
 *                 mobile_number:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     value:
 *                       type: string
 *                     verified:
 *                       type: boolean
 *                 address:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     line1:
 *                       type: string
 *                       nullable: true
 *                     city:
 *                       type: string
 *                       nullable: true
 *                     state:
 *                       type: string
 *                       nullable: true
 *                     postal_code:
 *                       type: string
 *                       nullable: true
 *                     country:
 *                       type: string
 *                       nullable: true
 *                     formatted:
 *                       type: string
 *                       nullable: true
 *                 entitlements:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       value:
 *                         type: string
 *                       type:
 *                         type: string
 *                       display:
 *                         type: string
 *                   description: RFC 7643 entitlements pushed by SCIM (empty array when none are stored)
 *       404:
 *         description: User not found
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 */
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      include: [{ association: 'organization', attributes: ['id', 'name', 'org_uuid'] }],
    });

    if (!user) {
      return problem(res, req, {
        status: 404,
        type: 'not-found',
        title: req.__('users.userNotFound'),
      });
    }

    res.set('Cache-Control', 'no-store');
    return res.status(200).send(await profileOf(user, req));
  } catch (error) {
    log.error.error('Error retrieving user profile:', error);
    return problem(res, req, {
      status: 500,
      type: 'internal',
      title: req.__('users.profile.error'),
    });
  }
};
