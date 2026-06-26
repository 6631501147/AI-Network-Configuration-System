# AI-Based Automatic Network Configuration System

AIBasedAutomaticNetworkConfigurationSystem is an IAM-integrated system for MFU that combines an intelligent network automation engine with a full-stack web application. It includes:

- **AI Network Automation** — Automatically configures routers and PCs in GNS3 using Python, Netmiko, and Google Gemini.
- **Backend API** — Node.js backend for AIBasedAutomaticNetworkConfigurationSystem registry records.
- **Vue Frontend** — Dashboard, AIBasedAutomaticNetworkConfigurationSystem registry, account directory, settings, and permission management.
- **IAM Authentication** — Delegated authentication and permission filtering.
- **Docker Compose** — Local/server deployment files.
- **GitLab CI** — GitLab deploy compose templates for Harbor-based delivery.

---

## 🚀 AI Automation Features

| Feature | Description |
|---|---|
| **Auto Router Config** | Configures interfaces, IP addresses, descriptions, and no-shutdown |
| **Auto OSPF Config** | Sets up OSPF dynamic routing between all routers |
| **Auto VPCS Config** | Assigns IP/gateway to all PCs via Telnet |
| **Connectivity Verification** | Runs ping tests between all branches |
| **Report Generation** | Saves full config report to `results/` |
| **Activity Logging** | Writes timestamped events to `logs/activity.log` |
| **AI Topology Scanner** | Uses Gemini Vision to analyze topology screenshots and build GNS3 `.gns3` files |
| **AI Topology Editor** | Text-based AI modification of existing topologies |
| **Web Dashboard** | Browser-based GUI to view, scan, and modify topologies |

---

## ⚙️ Runtime Ports

- Backend host port: `8095`
- Frontend host port: `8084`
- Production domain: `https://ai-based-automatic-network-configuration-system.mfu.ac.th`

---

## 🐳 Local Run (Docker)

```bash
docker compose --env-file .env.local up -d --build
```

Open `http://127.0.0.1:8084`.

## Server Run

```bash
APP_ENV=prod ./server.sh deploy
```

The server compose binds backend and frontend to `127.0.0.1` by default so Nginx can publish the public domain.

---

## 🖥️ AI Automation Usage

### Prerequisites
- Python 3.8+
- GNS3 (with VM running)
- Cisco IOS image loaded in GNS3
- Google Gemini API key

### Install Python Dependencies

```bash
pip install -r requirements.txt
```

### Option A — Full Auto-Configuration (CLI)

```bash
python configure.py
```

### Option B — AI Web Dashboard

```bash
python start_dashboard.py
```

Opens `http://localhost:8000/dashboard.html`.

---

## 🖧 Network Topology

| Router | Role | LAN Network |
|---|---|---|
| R1 | Head Office | 192.168.10.0/24 |
| R2 | Branch 1 | 192.168.20.0/24 |
| R3 | Branch 2 | 192.168.30.0/24 |
| R4 | Branch 3 | 192.168.40.0/24 |
| R5 | Data Center | 192.168.50.0/24 |
| R7 | ISP | — |
| R8 | Partner Company | 192.168.80.0/24 |

Routing Protocol: **OSPF Area 0**

---

## 🔧 Backend Scripts

Run inside `backend-node`:

- `npm run start:local`
- `npm run test:contracts`
- `npm run register:iam:local`
- `npm run bootstrap:local`
- `npm run bootstrap`
- `npm run reset:permissions`
- `npm run smoke:live:user`

---

## ⚠️ Important

Real env files are present in this workspace and ignored by git. Do not commit secrets. Register the AIBasedAutomaticNetworkConfigurationSystem IAM managed client before production login is expected to work end-to-end. Set `PROJECT_PERMISSION_ACCOUNT_EMAIL` or `PROJECT_PERMISSION_ACCOUNT_ID` before running bootstrap.

---

## 🛠️ Technologies

| Technology | Purpose |
|---|---|
| Node.js | Backend API |
| Vue.js | Frontend SPA |
| Python | Network automation scripting |
| GNS3 | Network simulation |
| Netmiko | Router automation via Telnet |
| Google Gemini | AI topology analysis |
| Docker | Containerized deployment |
| GitLab CI | Continuous delivery pipeline |
