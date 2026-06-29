# Product Requirements Document (PRD)

# AI-Based Automatic Network Configuration System

---

## 1. Introduction

### Project Title
AI-Based Automatic Network Configuration System Using GNS3 and Python

### Project Description
This project develops an intelligent network automation system that automatically configures routers and PCs in a GNS3 environment using Python automation scripts.

The system reduces manual configuration effort, minimizes human error, and speeds up enterprise network deployment.

---

## 2. Problem Statement

Traditional network configuration requires network engineers to manually configure routers and PCs using CLI commands.

### Existing Problems
- Time-consuming configuration process
- Repetitive manual tasks
- Human configuration errors
- Difficult management for large topologies
- Slow deployment process

The project aims to automate network configuration using Python and AI-assisted automation concepts.

---

## 3. Project Objectives

### Main Objective
To develop an AI-assisted automatic network configuration system using GNS3 and Python.

### Sub Objectives
- Automatically configure router interfaces
- Automatically assign IP addresses
- Automatically configure OSPF routing
- Automatically configure VPCS
- Reduce manual CLI configuration
- Verify network connectivity automatically

---

## 4. Project Scope

The system focuses on:
- Cisco IOS routers
- GNS3 simulated environments
- Python-based automation
- Small-to-medium enterprise topologies
- OSPF routing protocol

---

## 5. Functional Requirements

### FR-1 Topology Input
The system shall accept a network topology created in GNS3.

### FR-2 Router Configuration
The system shall configure:
- Router interfaces
- IP addresses
- Interface descriptions
- No shutdown commands

### FR-3 OSPF Configuration
The system shall automatically configure OSPF routing between routers.

### FR-4 PC Configuration
The system shall configure VPCS IP settings automatically.

### FR-5 Connectivity Verification
The system shall verify connectivity using ping tests.

### FR-6 Report Generation
The system shall generate automation result reports.

---

## 6. Non-Functional Requirements

- Fast automation execution
- Stable router communication
- Easy-to-use project structure
- Reliable connectivity verification
- Compatible with GNS3 environment

---

## 7. Security Requirements

- Secure SSH/Telnet router access
- Authorized device management only
- Configuration activity logging
- Protected automation environment
- Secure network management process

---

## 8. Technical Requirements

| Technology | Purpose |
|------------|---------|
| Python | Automation scripting |
| GNS3 | Network simulation |
| Netmiko | Router automation |
| Paramiko | SSH communication |
| Cisco IOS | Router operating system |
| VS Code | Development environment |
| GitHub | Version control |

---

## 9. System Workflow

User Creates Topology in GNS3
↓
Topology Screenshot Captured
↓
Python Automation Script Generated
↓
Routers Configured Automatically
↓
OSPF Routing Configured
↓
Connectivity Verification Performed
↓
Results Saved

---

## 10. Testing Requirements

### Connectivity Testing
- Ping between routers
- Ping between branch networks
- End-to-end communication testing

### Routing Verification
- OSPF neighbor verification
- Routing table verification
- Interface status verification

---

## 11. Expected Results

- Reduced manual configuration
- Faster deployment process
- Reduced configuration errors
- Successful automated router configuration
- Successful OSPF communication
- Successful connectivity verification

---

## 12. Proof of Concept (POC)

The project successfully demonstrates:
- Enterprise topology inside GNS3
- Automatic router configuration
- Automatic OSPF configuration
- Connectivity verification using ping tests
- Python automation workflow
- GitHub project integration

---

## 13. Future Improvements

### Planned Features
- AI topology image recognition
- GUI dashboard
- Multi-routing protocol support
- Firewall automation
- Dynamic topology detection
- Real-time monitoring dashboard

---

## 14. Conclusion

The AI-Based Automatic Network Configuration System demonstrates how Python automation and network simulation can reduce manual configuration effort and improve deployment efficiency in enterprise networks.