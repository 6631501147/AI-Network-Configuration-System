# AI-Based Automatic Network Configuration System

An intelligent network automation system that automatically configures routers and PCs in a GNS3 simulated enterprise network using Python, Netmiko, and AI (Google Gemini).

---

## 🚀 Features

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

## 📁 Project Structure

```
AI-Network-Configuration-System/
├── configure.py              # Entry point: runs full auto-config
├── start_dashboard.py        # Entry point: starts web dashboard
├── parse_topo.py             # Utility: parse and print .gns3 topology info
├── requirements.txt          # Python dependencies
├── .env                      # API keys (GEMINI_API_KEY)
├── .gitignore
│
├── scripts/
│   ├── __init__.py
│   ├── router_automation.py  # Core: router + VPCS + OSPF + ping + report
│   ├── logger.py             # Activity logging → logs/activity.log
│   └── ai_scanner/
│       ├── __init__.py
│       ├── gemini_vision.py  # Gemini Vision: image → topology JSON
│       └── gns3_builder.py   # Build .gns3 project file from topology JSON
│
├── topology/                 # GNS3 topology files (.gns3)
│   ├── KOTHANT.gns3          # Main enterprise topology
│   ├── scanned.gns3          # AI-generated from image scan
│   ├── modified.gns3         # AI-modified topology
│   └── manual.gns3           # Manually saved from dashboard
│
├── results/                  # Auto-config reports
│   ├── auto_config_report.txt
│   ├── ospf_neighbors.txt
│   └── ping_test.txt
│
├── logs/                     # Activity logs (Security requirement)
│   └── activity.log          # Written at runtime
│
├── screenshots/              # Topology screenshots for AI scanning
│
├── dashboard.html            # Web dashboard UI
├── dashboard.css             # Dashboard styles
├── dashboard.js              # Dashboard logic
│
└── docs/
    ├── PRD.md
    ├── project_overview.md
    ├── system_workflow.md
    ├── installation_guide.md
    ├── topology_description.md
    ├── commandpromt.md
    └── future_improvements.md
```

---

## ⚙️ Installation

### 1. Prerequisites
- Python 3.8+
- GNS3 (with VM running)
- Cisco IOS image loaded in GNS3
- Google Gemini API key (for AI features)

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

Edit `.env`:
```
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## ▶️ Usage

### Option A — Full Auto-Configuration (CLI)

Automatically configures all routers and PCs in your GNS3 topology via Telnet.

```bash
python configure.py
```

- Configures all routers (interfaces, IP, OSPF)
- Configures all PCs (IP/gateway)
- Waits for OSPF convergence
- Runs ping verification tests
- Saves report to `results/auto_config_report.txt`
- Logs all activity to `logs/activity.log`

### Option B — Web Dashboard (GUI)

```bash
python start_dashboard.py
```

Opens `http://localhost:8000/dashboard.html` in your browser.

Dashboard features:
- **View** topology files (`.gns3`)
- **Upload** a topology screenshot → AI scans and generates `scanned.gns3`
- **Modify** topology via text instructions → AI edits and saves `modified.gns3`
- **Manual topology builder** → saves `manual.gns3`

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

## ✅ Verification

After running `configure.py`, verify on the router CLI:

```
show ip ospf neighbor
show ip interface brief
ping <destination-ip>
```

---

## 🛠️ Technologies

| Technology | Purpose |
|---|---|
| Python | Automation scripting |
| GNS3 | Network simulation |
| Netmiko | Router automation via Telnet |
| Paramiko | SSH communication |
| Google Gemini | AI topology analysis |
| python-dotenv | Environment variable management |
| Cisco IOS | Router operating system |

---

## 📄 License

See [LICENSE](LICENSE)
