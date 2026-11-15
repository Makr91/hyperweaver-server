import { compareSync } from 'bcryptjs';
import { log } from '../../utils/Logger.js';
import { problem } from '../../utils/problem.js';
import db from '../../models/index.js';

const { user: User, role: Role, organization: Organization, UserOrg } = db;

const CONFIRM_TEXT = 'DELETE';

const refused = (req, res, status, type, title) => problem(res, req, { status, type, title });

/**
 * Whether the user is the only account holding the global admin role.
 * @param {Object} user - The users row
 * @returns {Promise<boolean>} True for the last administrator
 */
const isLastAdmin = async user => {
  const roles = await user.getRoles();
  if (!roles.some(role => role.name === 'admin')) {
    return false;
  }
  const admins = await User.count({
    distinct: true,
    include: [{ model: Role, where: { name: 'admin' }, required: true }],
  });
  return admins === 1;
};

/**
 * The user's memberships with the owner and member counts of each
 * organization.
 * @param {number} userId - The user's id
 * @returns {Promise<Array<{membership: Object, owners: number, members: number}>>} One entry per membership
 */
const membershipCounts = async userId => {
  const memberships = await UserOrg.findAll({
    where: { user_id: userId },
    include: [{ model: Organization, as: 'organization', attributes: ['id', 'name'] }],
  });
  return Promise.all(
    memberships.map(async membership => ({
      membership,
      owners: await UserOrg.count({
        where: { organization_id: membership.organization_id, role: 'owner' },
      }),
      members: await UserOrg.count({ where: { organization_id: membership.organization_id } }),
    }))
  );
};

/**
 * @swagger
 * /api/auth/delete-account:
 *   delete:
 *     summary: Delete the caller's own account, proving the password
 *     description: Deletes the signed-in local account once password matches and confirm_text is DELETE. Refused for the last administrator, and while the account is the only owner of an organization that has other members. An organization the account was the only member of is deleted with it.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password, confirm_text]
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *               confirm_text:
 *                 type: string
 *                 enum: [DELETE]
 *     responses:
 *       200:
 *         description: Account deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 organizations_deleted:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: confirm_text is not DELETE, the account is the last administrator, or it is the sole owner of an organization with other members
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 *       403:
 *         description: The password is wrong, or the account has no local password
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 *       404:
 *         description: User not found
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 */
export const deleteOwnAccount = async (req, res) => {
  const { password, confirm_text: confirmText } = req.body || {};

  try {
    if (confirmText !== CONFIRM_TEXT) {
      return refused(req, res, 400, 'bad-request', req.__('users.confirmTextMismatch'));
    }
    const user = await User.findByPk(req.userId);
    if (!user) {
      return refused(req, res, 404, 'not-found', req.__('users.userNotFound'));
    }
    if (!user.password) {
      return refused(req, res, 403, 'forbidden', req.__('users.noLocalPassword'));
    }
    if (typeof password !== 'string' || !compareSync(password, user.password)) {
      return refused(req, res, 403, 'forbidden', req.__('users.currentPasswordIncorrect'));
    }
    if (await isLastAdmin(user)) {
      return refused(req, res, 400, 'bad-request', req.__('users.lastAdmin'));
    }

    const counts = await membershipCounts(user.id);
    const blocking = counts.find(
      entry => entry.membership.role === 'owner' && entry.owners === 1 && entry.members > 1
    );
    if (blocking) {
      return refused(
        req,
        res,
        400,
        'bad-request',
        req.__('users.cannotDeleteSoleOwner', {
          organization: blocking.membership.organization?.name || '',
        })
      );
    }

    const lonely = counts
      .filter(entry => entry.members === 1)
      .map(entry => entry.membership.organization)
      .filter(Boolean);

    const transaction = await db.sequelize.transaction();
    try {
      await user.destroy({ transaction });
      await Organization.destroy({ where: { id: lonely.map(org => org.id) }, transaction });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    if (req.session) {
      req.session.destroy(err => {
        if (err) {
          log.error.error('Session destruction failed after account deletion:', err);
        }
      });
    }

    return res.status(200).send({
      message: req.__('users.deleted'),
      organizations_deleted: lonely.map(org => org.name),
    });
  } catch (err) {
    log.error.error('Error deleting own account:', err);
    return problem(res, req, {
      status: 500,
      type: 'internal',
      title: req.__('users.delete.error', { userId: req.userId }),
    });
  }
};
