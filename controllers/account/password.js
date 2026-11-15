import { compareSync, hashSync } from 'bcryptjs';
import { log } from '../../utils/Logger.js';
import { problem, refuse } from '../../utils/problem.js';
import { getPasswordMinLength } from '../../utils/rules.js';
import db from '../../models/index.js';
import { getBcryptRounds, getPasswordPolicyErrors } from '../auth/helpers.js';

const { user: User } = db;

const MAX_LENGTH = 128;

const forbidden = (req, res, key) =>
  problem(res, req, { status: 403, type: 'forbidden', title: req.__(key) });

/**
 * The failing rules of a new password: its length against the host's minimum
 * and 128, then the blocklist and composition rules.
 * @param {string} password - The candidate password
 * @returns {Array<{pointer: string, rule: string, params: Object}>} Failing rules, or none
 */
const newPasswordErrors = password => {
  const pointer = '/new_password';
  if (typeof password !== 'string' || password === '') {
    return [{ pointer, rule: 'required', params: {} }];
  }
  const minLength = getPasswordMinLength();
  if (password.length < minLength) {
    return [{ pointer, rule: 'minLength', params: { minLength } }];
  }
  if (password.length > MAX_LENGTH) {
    return [{ pointer, rule: 'maxLength', params: { maxLength: MAX_LENGTH } }];
  }
  return getPasswordPolicyErrors(password, pointer);
};

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change the caller's own password, proving the current one
 *     description: Sets a new password for the signed-in local account once current_password matches the stored one and confirm_password equals new_password. An account without a local password is refused.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [current_password, new_password, confirm_password]
 *             properties:
 *               current_password:
 *                 type: string
 *                 format: password
 *               new_password:
 *                 type: string
 *                 format: password
 *                 description: At least the host's configured minimum and at most 128 characters
 *               confirm_password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password changed
 *       400:
 *         description: confirm_password differs from new_password
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 *       403:
 *         description: The current password is wrong, or the account has no local password
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
 *       422:
 *         description: The new password breaks a rule
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 */
export const changeOwnPassword = async (req, res) => {
  const {
    current_password: currentPassword,
    new_password: newPassword,
    confirm_password: confirmPassword,
  } = req.body || {};

  try {
    const errors = newPasswordErrors(newPassword);
    if (errors.length > 0) {
      return refuse(res, req, errors);
    }
    if (newPassword !== confirmPassword) {
      return problem(res, req, {
        status: 400,
        type: 'bad-request',
        title: req.__('users.passwordsDoNotMatch'),
      });
    }

    const user = await User.findByPk(req.userId);
    if (!user) {
      return problem(res, req, {
        status: 404,
        type: 'not-found',
        title: req.__('users.userNotFound'),
      });
    }
    if (!user.password) {
      return forbidden(req, res, 'users.noLocalPassword');
    }
    if (typeof currentPassword !== 'string' || !compareSync(currentPassword, user.password)) {
      return forbidden(req, res, 'users.currentPasswordIncorrect');
    }

    user.password = hashSync(newPassword, getBcryptRounds());
    await user.save();
    return res.status(200).send({ message: req.__('users.passwordChanged') });
  } catch (err) {
    log.error.error('Error changing own password:', err);
    return problem(res, req, {
      status: 500,
      type: 'internal',
      title: req.__('errors.operationFailed'),
    });
  }
};
