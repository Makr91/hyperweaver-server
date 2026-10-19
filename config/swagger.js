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
              items: { type: 'string', enum: ['ROLE_USER', 'ROLE_ADMIN', 'ROLE_SUPER_ADMIN'] },
              example: ['ROLE_ADMIN'],
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
          required: ['username', 'email', 'password', 'confirmPassword'],
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
            confirmPassword: {
              type: 'string',
              description: 'Password confirmation (must match password)',
              example: 'securePassword123',
            },
            organizationName: {
              type: 'string',
              description: 'Organization name (for new organization) or invitation code',
              example: 'My Company',
            },
            inviteCode: {
              type: 'string',
              description: 'Invitation code (if joining existing organization)',
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
            entityName: {
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
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Server addition timestamp',
              example: '2025-01-04T17:18:00.324Z',
            },
            lastUsed: {
              type: 'string',
              format: 'date-time',
              description: 'Last usage timestamp',
              example: '2025-01-04T17:19:19.921Z',
              nullable: true,
            },
            isActive: {
              type: 'boolean',
              description: 'Whether the server is active',
              example: true,
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
            name: {
              type: 'string',
              description: 'Organization name',
              example: 'Acme Corporation',
            },
            description: {
              type: 'string',
              description: 'Organization description',
              example: 'Technology company specializing in virtual infrastructure',
              nullable: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Organization creation timestamp',
              example: '2025-01-04T17:18:00.324Z',
            },
            isActive: {
              type: 'boolean',
              description: 'Whether the organization is active',
              example: true,
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
              example: 'Username, email, password, and confirm password are required',
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
  apis: ['./controllers/**/*.js', './routes/**/*.js', './models/**/*.js'],
};

const specs = swaggerJsdoc(options);

export { specs, swaggerUi };
