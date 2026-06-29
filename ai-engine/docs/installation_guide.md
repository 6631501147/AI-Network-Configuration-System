
# Installation Guide

## Requirements

- Python 3.8+
- GNS3 (with VM running and Cisco IOS image loaded)
- VS Code (or any editor)
- Google Gemini API key (for AI topology scanning features)

---

## Step 1 — Install Python Packages

```bash
pip install -r requirements.txt
```

This installs:
- `netmiko` — router automation via Telnet
- `paramiko` — SSH communication
- `google-generativeai` — Gemini Vision AI (topology scanner)
- `python-dotenv` — loads `.env` variables

---

## Step 2 — Configure API Key

Edit the `.env` file in the project root:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## Step 3A — Run Auto-Configuration (CLI)

Make sure GNS3 is running with all routers started, then:

```bash
python configure.py
```

This will:
1. Configure all PCs (VPCS)
2. Configure all routers (interfaces + OSPF)
3. Wait for OSPF convergence
4. Run ping verification tests
5. Save report → `results/auto_config_report.txt`
6. Save activity log → `logs/activity.log`

---

## Step 3B — Run Web Dashboard (GUI)

```bash
python start_dashboard.py
```

Opens `http://localhost:8000/dashboard.html` automatically.

---

## Step 4 — Verify Connectivity

On the router CLI inside GNS3:

```
show ip ospf neighbor
show ip interface brief
ping <destination-ip>
```

Example ping:
```
R1# ping 192.168.20.10
```
