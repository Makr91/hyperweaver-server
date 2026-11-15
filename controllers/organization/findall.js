// findall.js
import { log } from '../../utils/Logger.js';
import { problem } from '../../utils/problem.js';
import db from '../../models/index.js'; // Keep this for Sequelize
import { containing } from '../../utils/like.js';
const { organization: Organization, user: User, Sequelize } = db;
const { Op } = Sequelize;

/**
 * @swagger
 * /api/organization:
 *   get:
 *     summary: Get all organizations
 *     description: Retrieve all organizations with optional name filtering
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: organization
 *         schema:
 *           type: string
 *         description: Filter organizations by name (partial match)
 *     responses:
 *       200:
 *         description: List of organizations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Organization'
 *       401:
 *         description: Unauthorized - invalid token
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
// Retrieve all Organizations from the database.
export const findAll = async (req, res) => {
  const { organization } = req.query;

  try {
    const condition = organization ? { name: { [Op.like]: containing(organization) } } : null;
    const organizations = await Organization.findAll({
      where: condition,
      include: [
        {
          model: User,
          as: 'members',
          attributes: ['id'],
        },
      ],
    });

    return res.status(200).send(organizations.map(org => org.toJSON()));
  } catch (err) {
    log.error.error('Error retrieving organizations:', err);
    return problem(res, req, {
      status: 500,
      type: 'internal',
      title: req.__('organizations.findAllError'),
    });
  }
};
