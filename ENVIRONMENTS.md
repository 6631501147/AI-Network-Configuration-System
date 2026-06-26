# AIBasedAutomaticNetworkConfigurationSystem Environments

The AIBasedAutomaticNetworkConfigurationSystem app has real env files for local, preprod, and production:

- Root compose env: `.env.local`, `.env.preprod`, `.env.prod`, `.env`
- Backend env: `backend-node/.env.local`, `backend-node/.env.preprod`, `backend-node/.env.prod`
- Frontend env: `frontend-vue/.env.localdev`, `frontend-vue/.env.preprod`, `frontend-vue/.env.production`

All environments point to the AIBasedAutomaticNetworkConfigurationSystem database and use the AIBasedAutomaticNetworkConfigurationSystem IAM scope set:

- `ai.based.automatic.network.configuration.system.registry.read`
- `ai.based.automatic.network.configuration.system.registry.write`
- `ai.based.automatic.network.configuration.system.report.read`

Production/preprod frontend builds use same-origin API routing through Nginx:

- `VUE_APP_API_BASE_URL=/`
- `VUE_APP_SOCKET_URL=same-origin`

Local frontend points directly at the backend:

- `VUE_APP_API_BASE_URL=http://127.0.0.1:8215`
- `VUE_APP_SOCKET_URL=http://127.0.0.1:8215`
