import nodemailer from 'nodemailer';
import { loadConfig } from '../../utils/config.js';
import { log } from '../../utils/Logger.js';

let mailConfig = null;
let appConfig = null;

/**
 * Initialize mail configuration
 */
const init = () => {
  try {
    const fullConfig = loadConfig();

    mailConfig = fullConfig.mail;
    appConfig = fullConfig.frontend;

    if (!mailConfig) {
      log.mail.warn('Mail configuration not found');
    }
  } catch (error) {
    log.mail.error('Failed to load mail configuration', { error: error.message });
  }
};

/**
 * Get mail configuration
 */
export const getConfig = () => {
  if (!mailConfig) {
    init();
  }
  return mailConfig;
};

/**
 * Get app configuration (loaded alongside the mail config)
 */
export const getAppConfig = () => {
  if (!mailConfig) {
    init();
  }
  return appConfig;
};

/**
 * Create nodemailer transporter from the UI-metadata-format mail configuration
 */
export const createTransporter = () => {
  const config = getConfig();

  if (!config) {
    throw new Error('Mail configuration not available');
  }

  if (!config.smtp_host || !config.smtp_port || !config.smtp_from) {
    throw new Error('Incomplete mail configuration. Missing smtp_host, smtp_port, or smtp_from');
  }

  const transporterConfig = {
    host: config.smtp_host,
    port: config.smtp_port,
    secure: config.smtp_secure || false,
  };

  if (config.smtp_user && config.smtp_password) {
    transporterConfig.auth = {
      user: config.smtp_user,
      pass: config.smtp_password,
    };
  }

  return nodemailer.createTransport(transporterConfig);
};
