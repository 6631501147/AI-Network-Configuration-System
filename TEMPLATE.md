# AI Based Automatic Network Configuration System

Generated from the shared MFU IAM project template.

## IAM Setup

1. Review `backend-node/.env.local`, `.env.preprod`, and `.env.prod`.
2. Confirm `IAM_ADMIN_*` values. The generator inherits them from the source backend env when available, or leaves placeholders for manual setup.
3. Register the project B2B client:

```sh
cd backend-node
npm install
npm run register:iam:local
```

4. Bootstrap scoped Permission Matrix rows and assign the configured owner account:

```sh
npm run bootstrap:local
```

## Local Run

```sh
docker compose --env-file .env.local up -d --build
```

## GitLab CI/CD

The generated `.gitlab-ci.yml` builds backend/frontend images, pushes them to Harbor, and deploys `docker-compose.gitlab.yml` to `/opt/service/ai-based-automatic-network-configuration-system`.

Configure these masked GitLab CI/CD variables before pushing `main`:

- `HARBOR_USERNAME`
- `HARBOR_PASSWORD`
- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_PASSWORD`
- `SUDO_PASSWORD`

The GitLab Runner must use the Docker executor with privileged mode enabled for Docker-in-Docker.

## Required IAM Permission Paths

- `/ai-based-automatic-network-configuration-system/security/permission`
- `/dashboard`
- `/ai-based-automatic-network-configuration-system/registry`
- `/ai-based-automatic-network-configuration-system/review`
- `/ai-based-automatic-network-configuration-system/reports`
- `/operations/business`
- `/management/category`
- `/config/message-authen`
- `/config/email-notifications`
- `/config/workflow-actions`
- `/config/runtime-access`
- `/config/database-backup`
- `/config/setting-message`
- `/config/verification`
- `/setting/group`
- `/setting/message-status`
- `/security/permissions/menu`
- `/security/permissions/group`
- `/security/permissions/matrix`
- `/security/audit`
- `/accounts/directory`
- `/accounts/lifecycle`
