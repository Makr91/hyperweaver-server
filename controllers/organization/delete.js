// delete.js
import { log } from '../../utils/Logger.js';
import { problem } from '../../utils/problem.js';
import db from '../../models/index.js';
import { notifyProfilesUpdated } from '../../utils/events.js';

const { organization: Organization, UserOrg } = db;

/**
 * @swagger
 * /api/organization/{organizationName}:
 *   delete:
 *     summary: Delete an organization
 *     description: Delete an organization and its memberships in one transaction (org owner or global admin).
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationName
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization name to delete
 *     responses:
 *       200:
 *         description: Organization deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Organization and its files deleted successfully."
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
const _delete = async (req, res) => {
  const { organization: organizationName } = req.params;

  try {
    const organization = await Organization.findOne({
      where: { name: organizationName },
    });

    const members = await UserOrg.findAll({
      where: { organization_id: organization.id },
      attributes: ['user_id'],
    });

    const transaction = await db.sequelize.transaction();
    try {
      await organization.destroy({ transaction });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
    notifyProfilesUpdated(members.map(member => member.user_id));

    return res.status(200).send({
      message: req.__('organizations.deleted'),
    });
  } catch (err) {
    log.error.error('Error deleting organization:', err);
    return problem(res, req, {
      status: 500,
      type: 'internal',
      title: req.__('organizations.deleteError'),
    });
  }
};

export { _delete as delete };
