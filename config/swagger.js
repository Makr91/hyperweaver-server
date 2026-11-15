import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const { version } = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Hyperweaver Server API',
      version,
      description:
        'API for Hyperweaver Server - control-plane web interface that aggregates and proxies the Hyperweaver and Zoneweaver agents',
      license: {
        name: 'GPL-3.0',
        url: 'https://www.gnu.org/licenses/gpl-3.0.html',
      },
      contact: {
        name: 'Hyperweaver Project',
        url: 'https://github.com/Makr91/hyperweaver-server',
      },
    },
    servers: [
      {
        url: '{protocol}://{host}',
        description: 'Current server',
        variables: {
          protocol: {
            enum: ['http', 'https'],
            default: 'https',
            description: 'The protocol used to access the server',
          },
          host: {
            default: 'localhost:3000',
            description: 'The hostname and port of the server',
          },
        },
      },
    ],
    components: {
      securitySchemes: {
        JwtAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-access-token',
          description:
            'The session JWT, minted by POST /api/auth/signin or the OIDC code exchange, sent as the x-access-token header.',
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description:
            'Authorization: Bearer carries the session JWT or an access token of a configured identity provider.',
        },
      },
      schemas: {
        Membership: {
          type: 'object',
          description: 'One organization of the signed-in person, in the identity provider shape',
          properties: {
            uuid: { type: 'string', example: '3f2c1a9e-7b4d-4e2a-9c6f-1d8e5a7b9c0d' },
            name: { type: 'string', example: 'Acme Corp' },
            roles: {
              type: 'array',
              items: { type: 'string', enum: ['OWNER', 'ADMIN', 'MEMBER', 'GUEST'] },
            },
            primary: { type: 'boolean' },
            personal: { type: 'boolean' },
            logo_url: { type: 'string', nullable: true },
            email_hash: { type: 'string', nullable: true },
          },
        },
        User: {
          type: 'object',
          description: 'The profile GET /api/user and the sign-in answers carry',
          properties: {
            id: { type: 'integer', example: 1 },
            username: { type: 'string', example: 'john_admin' },
            name: { type: 'string', nullable: true, example: 'John Admin' },
            preferred_language: { type: 'string', nullable: true, example: 'en' },
            preferred_mode: { type: 'string', nullable: true, example: 'dark' },
            preferred_theme: { type: 'string', nullable: true },
            preferred_motion: { type: 'string', nullable: true },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            verified: { type: 'boolean', example: true },
            email_hash: {
              type: 'string',
              description: 'SHA-256 of the trimmed, lower-cased email, for Gravatar',
            },
            avatar_url: { type: 'string', nullable: true },
            roles: {
              type: 'array',
              items: { type: 'string', enum: ['ROLE_USER', 'ROLE_ADMIN'] },
              example: ['ROLE_ADMIN'],
            },
            role: {
              type: 'string',
              enum: ['user', 'admin', 'super-admin'],
              description:
                'The one word the hosts pages read: super-admin for ROLE_ADMIN, admin for an owner or admin of any organization, user otherwise',
              example: 'super-admin',
            },
            organization: {
              type: 'string',
              nullable: true,
              description: 'The primary organization name',
            },
            organizations: {
              type: 'array',
              items: { $ref: '#/components/schemas/Membership' },
            },
            entitlements: { type: 'array', items: { type: 'object' }, example: [] },
          },
        },
        Problem: {
          type: 'object',
          description:
            'RFC 9457 problem details, the body of every refused write and every failed read, sent as application/problem+json',
          required: ['type', 'title', 'status', 'errors'],
          properties: {
            type: {
              type: 'string',
              format: 'uri',
              description:
                'A URI under https://auth.startcloud.com/probs/: validation, conflict, bad-request, authentication, forbidden, not-found, payload-too-large, throttled, internal, send-failed or bad-gateway',
              example: 'https://auth.startcloud.com/probs/validation',
            },
            title: {
              type: 'string',
              description: 'The human summary of the type',
              example: 'The request did not pass validation.',
            },
            status: {
              type: 'integer',
              description: 'The HTTP status of this occurrence',
              example: 422,
            },
            errors: {
              type: 'array',
              description: 'One entry per failing value',
              items: {
                type: 'object',
                required: ['pointer', 'rule', 'params', 'detail'],
                properties: {
                  pointer: {
                    type: 'string',
                    description: 'RFC 6901 JSON Pointer into the request body as sent',
                    example: '/name',
                  },
                  rule: {
                    type: 'string',
                    description: 'The JSON Schema keyword that failed, or unique',
                    example: 'pattern',
                  },
                  params: {
                    type: 'object',
                    description:
                      'The keyword value the message needs: { minLength }, { pattern } as the $defs name, { scope } on unique',
                    example: { pattern: 'slug' },
                  },
                  detail: {
                    type: 'string',
                    description:
                      'The host sentence for logs and other clients, never shown by the UI',
                    example: 'name must match slug',
                  },
                },
              },
            },
          },
        },
        SigninRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: {
              type: 'string',
              description: 'Username or email address',
              example: 'john_admin',
            },
            password: {
              type: 'string',
              description: 'User password',
              example: 'a long passphrase with spaces',
            },
            stay_logged_in: {
              type: 'boolean',
              description: 'Whether the session outlives the browser tab',
            },
          },
        },
        SigninResponse: {
          allOf: [
            { $ref: '#/components/schemas/User' },
            {
              type: 'object',
              properties: {
                access_token: {
                  type: 'string',
                  description: 'The session JWT, sent back as x-access-token',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                },
              },
            },
          ],
        },
        RegisterRequest: {
          type: 'object',
          required: ['username', 'email', 'password'],
          properties: {
            username: {
              type: 'string',
              description: 'Desired username',
              example: 'new_user',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'new_user@example.com',
            },
            password: {
              type: 'string',
              minLength: 15,
              maxLength: 128,
              description:
                'Password, at least the configured minimum (15 by default) and at most 128 characters',
              example: 'a long passphrase with spaces',
            },
            name: {
              type: 'string',
              maxLength: 255,
              description: 'Optional display name',
              example: 'New User',
            },
            invitation_token: {
              type: 'string',
              description: 'Optional invitation code for joining an organization',
              example: 'inv_abc123def456',
            },
          },
        },
        Server: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique server identifier',
              example: 1,
            },
            hostname: {
              type: 'string',
              description: 'Agent hostname or IP address',
              example: 'agent-host.example.com',
            },
            port: {
              type: 'integer',
              description: 'Server port',
              example: 5001,
            },
            protocol: {
              type: 'string',
              enum: ['http', 'https'],
              description: 'Connection protocol',
              example: 'https',
            },
            entity_name: {
              type: 'string',
              description: 'Display name for the agent',
              example: 'Production Agent',
            },
            description: {
              type: 'string',
              description: 'Server description',
              example: 'Main production server for machine management',
              nullable: true,
            },
            is_active: {
              type: 'boolean',
              description: 'Whether the server is active',
              example: true,
            },
            allow_insecure: {
              type: 'boolean',
              description: 'Whether a self-signed certificate of the agent is accepted',
              example: false,
            },
            capabilities: {
              type: 'object',
              nullable: true,
              description: "The agent's own GET /api/status answer as last read",
            },
            last_seen: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'When the agent last answered its status',
            },
            last_used: {
              type: 'string',
              format: 'date-time',
              description: 'Last usage timestamp',
              example: '2025-01-04T17:19:19.921Z',
              nullable: true,
            },
            org_uuids: {
              type: 'array',
              items: { type: 'string' },
              description:
                'The organizations that own the agent, on the list answer; empty for an agent no organization owns',
            },
            api_key: {
              type: 'string',
              description:
                "The agent's API key, on the list answer of a global admin who asks with include_api_keys=true",
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Server addition timestamp',
              example: '2025-01-04T17:18:00.324Z',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2025-01-04T17:19:19.921Z',
            },
          },
        },
        Organization: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique organization identifier',
              example: 1,
            },
            uuid: {
              type: 'string',
              description:
                "Immutable organization identity: the identity provider's uuid for a mirrored organization, a random uuid minted at creation for a local one",
              example: '3f1c2b9e-6a4d-4c1e-9b7a-2d8e5f0a1c34',
            },
            name: {
              type: 'string',
              description:
                "Organization name, the URL segment; a mirrored organization's follows its rename at the identity provider",
              example: 'Acme-Corporation',
            },
            display_name: {
              type: 'string',
              description: 'Human-readable organization name',
              example: 'Acme Corporation',
              nullable: true,
            },
            description: {
              type: 'string',
              description: 'Organization description',
              example: 'Technology company specializing in virtual infrastructure',
              nullable: true,
            },
            personal: {
              type: 'boolean',
              description:
                'Whether the identity provider marks this organization as a personal org',
              example: false,
            },
            org_code: {
              type: 'string',
              maxLength: 6,
              pattern: '^[0-9A-F]{6}$',
              description: '6-character hexadecimal organization code',
              example: 'A55D94',
              nullable: true,
            },
            base_domain: {
              type: 'string',
              maxLength: 253,
              description:
                'The domain a bare machine name takes on a create for a member of this organization',
              example: 'acme.example.com',
              nullable: true,
            },
            access_mode: {
              type: 'string',
              enum: ['private', 'invite', 'request'],
              description: 'Organization visibility and access mode',
              example: 'private',
            },
            default_role: {
              type: 'string',
              enum: ['member', 'admin', 'guest'],
              description:
                'Default role for new members; guest is the read-only fourth organization role',
              example: 'member',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Organization creation timestamp',
              example: '2025-01-04T17:18:00.324Z',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2025-01-04T17:19:19.921Z',
            },
          },
        },
        Invitation: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique invitation identifier',
              example: 1,
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Invited user email',
              example: 'invited@example.com',
            },
            code: {
              type: 'string',
              description: 'Invitation code',
              example: 'inv_abc123def456',
            },
            organizationId: {
              type: 'integer',
              description: 'Target organization ID',
              example: 1,
            },
            organizationName: {
              type: 'string',
              description: 'Target organization name',
              example: 'Acme Corporation',
            },
            invitedBy: {
              type: 'string',
              description: 'Username of the inviting admin',
              example: 'admin_user',
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              description: 'Invitation expiration timestamp',
              example: '2025-01-11T17:18:00.324Z',
            },
            status: {
              type: 'string',
              enum: ['pending', 'used', 'expired', 'revoked'],
              description: 'Invitation status',
              example: 'pending',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Invitation creation timestamp',
              example: '2025-01-04T17:18:00.324Z',
            },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Operation success status',
              example: true,
            },
            message: {
              type: 'string',
              description: 'Success message',
              example: 'Operation completed successfully',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Operation success status (always false for errors)',
              example: false,
            },
            message: {
              type: 'string',
              description: 'Error message',
              example: 'Authentication required',
            },
            details: {
              type: 'string',
              description: 'Additional error details (only in development)',
              example: 'JWT token expired at 2025-01-04T17:18:00.324Z',
            },
          },
        },
        ValidationErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Operation success status (always false for errors)',
              example: false,
            },
            message: {
              type: 'string',
              description: 'Validation error message',
              example: 'Hostname, port, protocol, and entity name are required',
            },
          },
        },
        ServiceAccount: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique service account identifier',
              example: 1,
            },
            username: {
              type: 'string',
              description: 'Service account username',
              example: 'john_admin-a1b2c3d4',
            },
            token: {
              type: 'string',
              description:
                'Raw authentication token. Returned ONLY in the creation response; stored hashed and never retrievable afterwards.',
              writeOnly: true,
              example: 'abc123def456...',
            },
            description: {
              type: 'string',
              description: 'Service account description',
              example: 'CI/CD automation account',
            },
            role: {
              type: 'string',
              enum: ['guest', 'member', 'admin', 'owner', 'superadmin'],
              description:
                'Stored role. guest, member, admin and owner act inside the organization only, at the lower of this role and the creator’s current role there, a guest reading only what is flagged for guests; superadmin acts as a global admin on every organization while its creator keeps ROLE_ADMIN.',
              example: 'member',
            },
            expires_at: {
              type: 'string',
              format: 'date-time',
              description: 'Token expiration timestamp',
              example: '2025-02-04T17:18:00.324Z',
            },
            last_used_at: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description:
                'When a raw key or session JWT of this service account was last accepted; null until its first use',
              example: '2025-01-20T08:41:12.004Z',
            },
            user_id: {
              type: 'integer',
              description: 'ID of the user who created this service account',
              example: 1,
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Service account creation timestamp',
              example: '2025-01-04T17:18:00.324Z',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2025-01-04T17:19:19.921Z',
            },
          },
        },
        ServiceAccountCreateRequest: {
          type: 'object',
          required: ['organization_id'],
          properties: {
            description: {
              type: 'string',
              description: 'Description of the service account purpose',
              example: 'CI/CD automation account',
            },
            expiration_days: {
              type: 'integer',
              minimum: 1,
              maximum: 365,
              description:
                'Number of days until token expires, at most auth.jwt.service_account_max_expiry_days',
              example: 30,
            },
            organization_id: {
              type: 'integer',
              description: 'Organization ID to scope the service account to',
              example: 1,
            },
            role: {
              type: 'string',
              enum: ['guest', 'member', 'admin', 'owner', 'superadmin'],
              default: 'member',
              description:
                'Role of the account, guest through the creator’s own role in the organization, a guest membership creating none; superadmin only for a global admin. Absent means member.',
              example: 'member',
            },
          },
        },
        SetupTokenRequest: {
          type: 'object',
          required: ['token'],
          properties: {
            token: {
              type: 'string',
              description: 'Setup authorization token',
              example: 'setup-token-abc123',
            },
          },
        },
        RestartEntry: {
          type: 'object',
          required: ['pointer', 'title', 'reason'],
          properties: {
            pointer: {
              type: 'string',
              description: 'RFC 6901 pointer of the changed key',
              example: '/server/port',
            },
            title: {
              type: 'string',
              description: "The key's title from its schema",
              example: 'HTTPS port',
            },
            reason: {
              type: 'string',
              description: 'Why the key needs a restart, from its schema',
              example: 'the listener is bound at boot',
            },
          },
        },
        ConfigSaved: {
          type: 'object',
          required: ['message', 'requires_restart'],
          properties: {
            message: {
              type: 'string',
              example: 'Configuration saved.',
            },
            requires_restart: {
              type: 'array',
              description: 'The changed keys that need a restart; empty when none',
              items: { $ref: '#/components/schemas/RestartEntry' },
            },
          },
        },
        RestartStatus: {
          type: 'object',
          required: [
            'restart_required',
            'requires_restart',
            'last_modified_by',
            'last_modified_time',
          ],
          properties: {
            restart_required: {
              type: 'boolean',
              description: 'True exactly when the list is not empty',
            },
            requires_restart: {
              type: 'array',
              description: 'The union of every write since the last restart',
              items: { $ref: '#/components/schemas/RestartEntry' },
            },
            last_modified_by: {
              type: 'string',
              nullable: true,
              description: 'The last actor; null until the first write of the process',
            },
            last_modified_time: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'RFC 3339 instant in UTC; null until the first write of the process',
            },
          },
        },
        ConfigUpdateRequest: {
          type: 'object',
          required: ['configs'],
          properties: {
            configs: {
              type: 'object',
              description: 'One JSON Merge Patch per file name',
              additionalProperties: {
                type: 'object',
                description: 'The merge patch over the raw file',
              },
              example: {
                app: {
                  frontend: {
                    frontend_url: 'https://hyperweaver.example.com',
                  },
                },
                db: {
                  database_type: 'sqlite',
                },
              },
            },
          },
        },
        ConfigResponse: {
          type: 'object',
          properties: {
            configs: {
              type: 'object',
              description: 'The raw files by name',
              additionalProperties: {
                type: 'object',
                description: 'One raw file parsed to JSON',
              },
            },
          },
        },
        MailTestRequest: {
          type: 'object',
          description:
            "The SMTP connection object's form values, unsaved; any member omitted keeps its stored value",
          properties: {
            host: { type: 'string', example: 'smtp.example.com' },
            port: { type: 'integer', example: 587 },
            secure: { type: 'boolean', example: true },
            reject_unauthorized: { type: 'boolean', example: true },
          },
        },
        MailTestResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Success message',
              example: 'Test email sent successfully',
            },
            message_id: {
              type: 'string',
              description: 'SMTP message ID',
              example: '<abc123@example.com>',
            },
          },
        },
      },
    },
    security: [
      {
        JwtAuth: [],
      },
    ],
  },
  apis: [
    './controllers/**/*.js',
    './routes/**/*.js',
    './models/**/*.js',
    './config/config-engine.js',
  ],
};

const specs = swaggerJsdoc(options);

export { specs, swaggerUi };
