from netmiko import ConnectHandler
import socket
import time
import os
from datetime import datetime
from scripts.logger import log_info, log_success, log_error, log_session_start, log_session_end

# ==================================================
# GNS3 VM IP
# ==================================================
GNS3_HOST = "192.168.154.128"

# ==================================================
# ROUTER CONSOLE PORTS
# ==================================================
routers = {
    "R1": {"host": GNS3_HOST, "port": 5000},
    "R2": {"host": GNS3_HOST, "port": 5001},
    "R3": {"host": GNS3_HOST, "port": 5002},
    "R4": {"host": GNS3_HOST, "port": 5003},
    "R5": {"host": GNS3_HOST, "port": 5004},
    "R7": {"host": GNS3_HOST, "port": 5006},
    "R8": {"host": GNS3_HOST, "port": 5007},
}

# ==================================================
# VPCS CONSOLE PORTS
# ==================================================
pcs = {
    "PC1": {"host": GNS3_HOST, "port": 5005, "cmd": "ip 192.168.10.10/24 192.168.10.1"},
    "PC2": {"host": GNS3_HOST, "port": 5009, "cmd": "ip 192.168.20.10/24 192.168.20.1"},
    "PC3": {"host": GNS3_HOST, "port": 5011, "cmd": "ip 192.168.30.10/24 192.168.30.1"},
    "PC4": {"host": GNS3_HOST, "port": 5013, "cmd": "ip 192.168.40.10/24 192.168.40.1"},
    "PC5": {"host": GNS3_HOST, "port": 5015, "cmd": "ip 192.168.50.10/24 192.168.50.1"},
    "PC6": {"host": GNS3_HOST, "port": 5017, "cmd": "ip 192.168.80.10/24 192.168.80.1"},
}

# ==================================================
# ROUTER CONFIGURATION
# Based on your real interface table
# ==================================================
router_configs = {
    "R1": [
        "hostname R1-HQ",
        "no ip domain-lookup",

        "interface FastEthernet0/0",
        "description HQ LAN - PC1",
        "ip address 192.168.10.1 255.255.255.0",
        "no shutdown",
        "exit",

        "interface FastEthernet2/1",
        "description WAN to R2 Branch1",
        "ip address 10.0.12.1 255.255.255.252",
        "no shutdown",
        "exit",

        "interface FastEthernet2/0",
        "description WAN to R3 Branch2",
        "ip address 10.0.13.1 255.255.255.252",
        "no shutdown",
        "exit",

        "interface FastEthernet1/0",
        "description WAN to R4 Branch3",
        "ip address 10.0.14.1 255.255.255.252",
        "no shutdown",
        "exit",

        "interface FastEthernet3/0",
        "description WAN to R7 ISP",
        "ip address 10.0.17.1 255.255.255.252",
        "no shutdown",
        "exit",

        "router ospf 1",
        "router-id 1.1.1.1",
        "network 192.168.10.0 0.0.0.255 area 0",
        "network 10.0.12.0 0.0.0.3 area 0",
        "network 10.0.13.0 0.0.0.3 area 0",
        "network 10.0.14.0 0.0.0.3 area 0",
        "default-information originate",
        "exit",

        "ip route 0.0.0.0 0.0.0.0 10.0.17.2",
    ],

    "R2": [
        "hostname R2-BRANCH1",
        "no ip domain-lookup",

        "interface FastEthernet0/0",
        "description Branch1 LAN - PC2",
        "ip address 192.168.20.1 255.255.255.0",
        "no shutdown",
        "exit",

        "interface FastEthernet2/1",
        "description WAN to R1 HQ",
        "ip address 10.0.12.2 255.255.255.252",
        "no shutdown",
        "exit",

        "router ospf 1",
        "router-id 2.2.2.2",
        "network 192.168.20.0 0.0.0.255 area 0",
        "network 10.0.12.0 0.0.0.3 area 0",
        "exit",
    ],

    "R3": [
        "hostname R3-BRANCH2",
        "no ip domain-lookup",

        "interface FastEthernet0/0",
        "description Branch2 LAN - PC3",
        "ip address 192.168.30.1 255.255.255.0",
        "no shutdown",
        "exit",

        "interface FastEthernet1/0",
        "description WAN to R1 HQ",
        "ip address 10.0.13.2 255.255.255.252",
        "no shutdown",
        "exit",

        "interface FastEthernet2/0",
        "description WAN to R5 Data Center",
        "ip address 10.0.35.1 255.255.255.252",
        "no shutdown",
        "exit",

        "router ospf 1",
        "router-id 3.3.3.3",
        "network 192.168.30.0 0.0.0.255 area 0",
        "network 10.0.13.0 0.0.0.3 area 0",
        "network 10.0.35.0 0.0.0.3 area 0",
        "exit",
    ],

    "R4": [
        "hostname R4-BRANCH3",
        "no ip domain-lookup",

        "interface FastEthernet0/0",
        "description Branch3 LAN - PC4",
        "ip address 192.168.40.1 255.255.255.0",
        "no shutdown",
        "exit",

        "interface FastEthernet1/0",
        "description WAN to R1 HQ",
        "ip address 10.0.14.2 255.255.255.252",
        "no shutdown",
        "exit",

        "router ospf 1",
        "router-id 4.4.4.4",
        "network 192.168.40.0 0.0.0.255 area 0",
        "network 10.0.14.0 0.0.0.3 area 0",
        "exit",
    ],

    "R5": [
        "hostname R5-DATACENTER",
        "no ip domain-lookup",

        "interface FastEthernet0/0",
        "description Data Center LAN - PC5",
        "ip address 192.168.50.1 255.255.255.0",
        "no shutdown",
        "exit",

        "interface FastEthernet1/0",
        "description WAN to R3 Branch2",
        "ip address 10.0.35.2 255.255.255.252",
        "no shutdown",
        "exit",

        "router ospf 1",
        "router-id 5.5.5.5",
        "network 192.168.50.0 0.0.0.255 area 0",
        "network 10.0.35.0 0.0.0.3 area 0",
        "exit",
    ],

    "R7": [
        "hostname R7-ISP",
        "no ip domain-lookup",

        "interface FastEthernet1/0",
        "description WAN to R1 HQ",
        "ip address 10.0.17.2 255.255.255.252",
        "no shutdown",
        "exit",

        "interface FastEthernet2/0",
        "description WAN to R8 Partner",
        "ip address 10.0.78.1 255.255.255.252",
        "no shutdown",
        "exit",

        "ip route 192.168.10.0 255.255.255.0 10.0.17.1",
        "ip route 192.168.20.0 255.255.255.0 10.0.17.1",
        "ip route 192.168.30.0 255.255.255.0 10.0.17.1",
        "ip route 192.168.40.0 255.255.255.0 10.0.17.1",
        "ip route 192.168.50.0 255.255.255.0 10.0.17.1",
        "ip route 192.168.80.0 255.255.255.0 10.0.78.2",
    ],

    "R8": [
        "hostname R8-PARTNER",
        "no ip domain-lookup",

        "interface FastEthernet0/0",
        "description Partner LAN - PC6",
        "ip address 192.168.80.1 255.255.255.0",
        "no shutdown",
        "exit",

        "interface FastEthernet2/0",
        "description WAN to R7 ISP",
        "ip address 10.0.78.2 255.255.255.252",
        "no shutdown",
        "exit",

        "ip route 0.0.0.0 0.0.0.0 10.0.78.1",
    ],
}

# ==================================================
# AUTO CONFIGURE VPCS
# ==================================================
def configure_pc(name, info):
    print(f"\n[PC] Configuring {name}...")
    log_info(f"Configuring PC: {name} at {info['host']}:{info['port']}")

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(10)
        s.connect((info["host"], info["port"]))
        time.sleep(1)

        commands = [
            info["cmd"],
            "save"
        ]

        for cmd in commands:
            s.sendall(cmd.encode("ascii") + b"\n")
            time.sleep(0.5)

        s.setblocking(False)
        output = b""
        try:
            while True:
                data = s.recv(4096)
                if not data:
                    break
                output += data
        except BlockingIOError:
            pass
        
        output = output.decode(errors="ignore")
        print(output)
        s.close()

        print(f"[PC] {name} configured successfully")
        log_success(f"PC {name} configured successfully")
        return True, output

    except Exception as e:
        error = f"[PC] Error configuring {name}: {e}"
        print(error)
        log_error(f"PC {name} configuration failed: {e}")
        return False, error

# ==================================================
# AUTO CONFIGURE ROUTER
# ==================================================
def configure_router(name, info):
    print(f"\n[ROUTER] Connecting to {name}...")
    log_info(f"Connecting to router: {name} at {info['host']}:{info['port']}")

    device = {
        "device_type": "cisco_ios_telnet",
        "host": info["host"],
        "port": info["port"],
        "fast_cli": False,
    }

    try:
        conn = ConnectHandler(**device)

        print(f"[ROUTER] Configuring {name}...")
        output = conn.send_config_set(router_configs[name])

        conn.send_command_timing("write memory")
        time.sleep(1)

        print(output)
        print(f"[ROUTER] {name} configured successfully")
        log_success(f"Router {name} configured and saved to NVRAM")

        conn.disconnect()
        return True, output

    except Exception as e:
        error = f"[ROUTER] Error configuring {name}: {e}"
        print(error)
        log_error(f"Router {name} configuration failed: {e}")
        return False, error

# ==================================================
# VERIFY ROUTER
# ==================================================
def verify_router(name, info):
    print(f"\n[VERIFY] Checking {name}...")

    device = {
        "device_type": "cisco_ios_telnet",
        "host": info["host"],
        "port": info["port"],
        "fast_cli": False,
    }

    try:
        conn = ConnectHandler(**device)

        results = []
        results.append(f"\n===== {name} show ip interface brief =====")
        results.append(conn.send_command("show ip interface brief"))

        results.append(f"\n===== {name} show ip route =====")
        results.append(conn.send_command("show ip route"))

        if name in ["R1", "R2", "R3", "R4", "R5"]:
            results.append(f"\n===== {name} show ip ospf neighbor =====")
            results.append(conn.send_command("show ip ospf neighbor"))

        conn.disconnect()

        final_output = "\n".join(results)
        print(final_output)
        return final_output

    except Exception as e:
        error = f"[VERIFY] Error checking {name}: {e}"
        print(error)
        return error

# ==================================================
# PING TEST FROM ROUTERS
# ==================================================
def ping_from_router(router_name, target_ip):
    info = routers[router_name]

    device = {
        "device_type": "cisco_ios_telnet",
        "host": info["host"],
        "port": info["port"],
        "fast_cli": False,
    }

    try:
        conn = ConnectHandler(**device)
        output = conn.send_command_timing(f"ping {target_ip}")
        conn.disconnect()

        success = "Success rate is 100 percent" in output or "Success rate is 80 percent" in output
        status = "SUCCESS" if success else "FAILED"

        print(f"[PING] {router_name} -> {target_ip}: {status}")
        return f"{router_name} -> {target_ip}: {status}\n{output}\n"

    except Exception as e:
        error = f"[PING] Error {router_name} -> {target_ip}: {e}"
        print(error)
        return error

# ==================================================
# MAIN PROGRAM
# ==================================================
RESULTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "results")


def main():
    log_session_start()
    os.makedirs(RESULTS_DIR, exist_ok=True)

    report = []
    report.append("AI-Based Automatic Enterprise Network Configuration Report")
    report.append(f"Generated at: {datetime.now()}")
    report.append("=" * 70)

    print("\n========== AUTO CONFIG START ==========")
    log_info("Auto-configuration session started")

    # 1. Configure PCs automatically
    report.append("\n\n===== PC CONFIGURATION =====")
    for pc_name, pc_info in pcs.items():
        ok, output = configure_pc(pc_name, pc_info)
        report.append(f"\n{pc_name}: {'SUCCESS' if ok else 'FAILED'}")
        report.append(output)

    # 2. Configure routers automatically
    report.append("\n\n===== ROUTER CONFIGURATION =====")
    for router_name, router_info in routers.items():
        ok, output = configure_router(router_name, router_info)
        report.append(f"\n{router_name}: {'SUCCESS' if ok else 'FAILED'}")
        report.append(output)

    print("\nWaiting 20 seconds for OSPF and routes to update...")
    time.sleep(20)

    # 3. Verify routers
    report.append("\n\n===== VERIFICATION RESULTS =====")
    for router_name, router_info in routers.items():
        output = verify_router(router_name, router_info)
        report.append(output)

    # 4. Ping tests
    report.append("\n\n===== PING TEST RESULTS =====")
    ping_tests = [
        ("R1", "192.168.20.10"),  # HQ to Branch1 PC
        ("R1", "192.168.30.10"),  # HQ to Branch2 PC
        ("R1", "192.168.40.10"),  # HQ to Branch3 PC
        ("R1", "192.168.50.10"),  # HQ to Data Center
        ("R2", "192.168.50.10"),  # Branch1 to Data Center
        ("R4", "192.168.50.10"),  # Branch3 to Data Center
        ("R8", "192.168.50.10"),  # Partner to Data Center
        ("R8", "192.168.10.10"),  # Partner to HQ
    ]

    for router_name, target_ip in ping_tests:
        result = ping_from_router(router_name, target_ip)
        report.append(result)

    # 5. Save report to results/ folder (FR-6)
    report_text = "\n".join(report)
    report_path = os.path.join(RESULTS_DIR, "auto_config_report.txt")

    with open(report_path, "w", encoding="utf-8") as file:
        file.write(report_text)

    log_success(f"Report saved to {report_path}")
    log_session_end()

    print("\n========== AUTO CONFIG COMPLETE ==========")
    print(f"Report saved as: {report_path}")


if __name__ == "__main__":
    main()