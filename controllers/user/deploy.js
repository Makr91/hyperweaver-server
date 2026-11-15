import { log } from '../../utils/Logger.js';
import { problem, refuse } from '../../utils/problem.js';
import { getOrigin } from '../../utils/config-loader.js';
import db from '../../models/index.js';
import { notifyProfileUpdated } from '../../utils/events.js';

const { user: User } = db;

const LOCAL = 'local';

const originOf = hostname => new URL(getOrigin(hostname)).origin;

const toWireShape = user => ({ deploy_target: user.deployTarget || LOCAL });

const userNotFound = (req, res) =>
  problem(res, req, { status: 404, type: 'not-found', title: req.__('users.userNotFound') });

/**
 * @swagger
 * /api/user/deploy:
 *   get:
 *     summary: The signed-in user's deploy preference
 *     description: deploy_target is local, the person's own desktop agent, or this server's origin; local while unset.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The deploy preference
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deploy_target:
 *                   type: string
 *                   example: local
 *       404:
 *         description: User not found
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 */
export const getDeploy = async (req, res) => {
  const user = await User.findByPk(req.userId);
  if (!user) {
    return userNotFound(req, res);
  }
  res.set('Cache-Control', 'no-store');
  return res.status(200).send(toWireShape(user));
};

/**
 * @swagger
 * /api/user/deploy:
 *   patch:
 *     summary: Update the signed-in user's deploy preference
 *     description: deploy_target takes local or this server's own origin, validated by the deploy form of /api/rules; an omitted key is left unchanged.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deploy_target:
 *                 type: string
 *                 description: local, or this server's origin
 *                 example: local
 *     responses:
 *       200:
 *         description: The deploy preference
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deploy_target:
 *                   type: string
 *       404:
 *         description: User not found
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 *       422:
 *         description: deploy_target is neither local nor this server's origin
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
export const updateDeploy = async (req, res) => {
  const { deploy_target: deployTarget } = req.body || {};
  const allowed = [LOCAL, originOf(req.hostname)];
  if (typeof deployTarget !== 'undefined' && !allowed.includes(deployTarget)) {
    return refuse(res, req, [
      { pointer: '/deploy_target', rule: 'enum', params: { enum: allowed.join(', ') } },
    ]);
  }

  try {
    const user = await User.findByPk(req.userId);
    if (!user) {
      return userNotFound(req, res);
    }
    if (typeof deployTarget !== 'undefined') {
      await user.update({ deployTarget });
      notifyProfileUpdated(user.id);
    }
    return res.status(200).send(toWireShape(user));
  } catch (err) {
    log.error.error('Error updating deploy preference:', err);
    return problem(res, req, {
      status: 500,
      type: 'internal',
      title: req.__('errors.operationFailed'),
    });
  }
};
