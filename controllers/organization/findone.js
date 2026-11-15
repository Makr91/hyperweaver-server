// findone.js
import { log } from '../../utils/Logger.js';
import { problem } from '../../utils/problem.js';
import db from '../../models/index.js';
import { resolveJwtUser } from '../../utils/jwtUser.js';
const { organization: Organization, user: User } = db;

const PUBLIC_FIELDS = [
  ['id', 'id'],
  ['name', 'name'],
  ['display_name', 'display_name'],
  ['description', 'description'],
  ['logo', 'logo'],
  ['emailHash', 'email_hash'],
];

/**
 * The organization as anyone may see it.
 * @param {Object} organization - The organization row
 * @returns {Object} The public profile
 */
const publicProfile = organization =>
  Object.fromEntries(PUBLIC_FIELDS.map(([attribute, key]) => [key, organization[attribute]]));

/**
 * @swagger
 * /api/organization/{organizationName}:
 *   get:
 *     summary: Get a specific organization
 *     description: Retrieve an organization. A signed-in caller (x-access-token JWT or an external bearer token) gets the full organization; an anonymous caller gets the public profile only (id, name, display name, description, logo, email_hash).
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     parameters:
 *       - in: path
 *         name: organizationName
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization name
 *     responses:
 *       200:
 *         description: Organization details, or the public profile for an anonymous caller
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organization'
 *       404:
 *         description: Organization not found
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
export const findOne = async (req, res) => {
  const { organization: organizationName } = req.params;

  try {
    const userId = req.userId || (await resolveJwtUser(req))?.userId || null;
    const organization = await Organization.findOne({
      where: { name: organizationName },
      include: [
        {
          model: User,
          as: 'members',
          attributes: ['id', 'username', 'emailHash', 'avatar_url'],
          through: { attributes: [] },
        },
      ],
    });

    if (!organization) {
      return problem(res, req, {
        status: 404,
        type: 'not-found',
        title: req.__('organizations.organizationNotFoundWithName', {
          organization: organizationName,
        }),
      });
    }

    if (!userId) {
      return res.send(publicProfile(organization));
    }

    return res.send(organization.toJSON());
  } catch (err) {
    log.error.error('Error in findOne:', err);
    return problem(res, req, {
      status: 500,
      type: 'internal',
      title: req.__('organizations.findOneError', { organization: organizationName }),
    });
  }
};
