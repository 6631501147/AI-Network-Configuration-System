# AI-Based Network Configuration System

Welcome to the AI-Based Network Configuration System! This project features a robust, browser-based network dashboard designed for interactive topology building and live configuration via an AI assistant.

## Features overview:
- **Topology Editor**: Drag-and-drop Routers, Switches, PCs, and Firewalls to build complex topologies.
- **AI Chatbot Integration**: Automatically generate `.gns3` topologies by uploading images, or instruct the AI to build the network via natural language.
- **Ping Matrix**: Live connectivity testing across the entire lab environment.

---

## GNS3 Simulated CLI Features

The `ai-engine` features a fully simulated, interactive GNS3-like Cisco IOS CLI. Every device in the lab topology (Routers, Switches, PCs) supports an active console connection with standard troubleshooting commands.

### Accessing the CLI
- Open the **Console** from any device's context menu in the Topology Editor.
- Type `connect <device_name>` to hot-swap your terminal context to another device instantly.

### Supported IOS Commands
The following diagnostic and verification commands are fully simulated based on the network's state in real-time:

#### Interface & Layer 2 Verification
- `show ip interface brief` / `sh ip int br` - View interface line protocol status and IP assignments.
- `show interfaces [name]` - Detailed counter metrics and physical layer info.
- `show mac address-table` - Verify dynamic/static MAC learning on switches.
- `show vlan` - View the VLAN database on switches.
- `show spanning-tree` - View STP root bridges and port roles (root, designated, blocked).

#### Routing & Layer 3 Verification
- `show ip route` - View the routing table (Connected, Local, Static, OSPF).
- `show arp` - Check IP-to-MAC resolution.
- `show ip ospf neighbor` - Verify OSPF adjacency states and dead timers.

#### Services & Security
- `show ip dhcp pool` - View DHCP bindings, leased IPs, and pool configuration.
- `show ip nat translations` - Monitor active Network Address Translations (Inside Local to Inside Global).
- `show logging` - View the local device's syslog event buffer (port security, ACL drops, neighbor changes).

#### Discovery & System
- `show cdp neighbors` - Verify Layer 2 discovery of directly attached network devices.
- `show running-config` - View the active device configuration script.
- `show version` - Display simulated hardware, uptime, and IOS version.

#### Active Troubleshooting
- `ping <ip-address>` - Execute a simulated ICMP echo request, honoring routing tables, ACLs, and interface states.
- `traceroute <ip-address>` - Trace the hop-by-hop forwarding path through the topology to identify routing loops or dead ends.
- `clear` - Clear the terminal screen.
