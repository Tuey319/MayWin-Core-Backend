# Physical and Environmental Security
**ISO/IEC 27001:2022 — Controls 7.1 through 7.14**
**MayWin Nurse Scheduling Platform**
Last reviewed: 2026-03-30

---

## Overview
The MayWin platform is fully cloud-hosted on AWS (ap-southeast-1). Physical security of servers, networking equipment, and datacentres is the responsibility of Amazon Web Services under the **AWS Shared Responsibility Model**. AWS maintains ISO 27001, SOC 1/2/3, and PCI DSS certifications for its physical infrastructure.

This document records the physical security posture for the platform and development environment.

---

## 7.1 — Physical Security Perimeters
**Owner: AWS**
AWS datacentres use multiple physical perimeters including fencing, security guards, CCTV, and access control systems. MayWin has no on-premises servers.

**Development environment**: Developer workstations should be used in secure locations. Do not work on the MayWin codebase or access production data in public spaces without VPN.

---

## 7.2 — Physical Entry Controls
**Owner: AWS**
AWS restricts datacentre entry to authorized personnel using multi-factor physical authentication. MayWin personnel do not have physical access to AWS facilities.

**Development**: Developer machines must have screen lock enabled (max 5-minute idle timeout recommended).

---

## 7.3 — Securing Offices, Rooms and Facilities
**Owner: AWS (datacentre) / Hospital (deployment site)**
- No MayWin-specific server rooms exist.
- If deployed on-premises at a hospital, the server must be in a locked, access-controlled room.
- Development machines must not be left unattended and unlocked in shared spaces.

---

## 7.4 — Physical Security Monitoring
**Owner: AWS**
AWS datacentres use 24/7 CCTV, intrusion detection, and security guard monitoring.

**Application-level monitoring**: `RequestLoggerMiddleware` and AWS CloudWatch provide logical monitoring equivalents at the application layer.

---

## 7.5 — Protecting Against Physical and Environmental Threats
**Owner: AWS**
AWS datacentres are protected against fire, flood, power failure, and climate extremes. AWS uses redundant power supplies and climate control.

**Recommendation**: Enable AWS Multi-AZ for RDS to protect against availability zone-level physical failures.

---

## 7.6 — Working in Secure Areas
Applies to development work:
- Production credentials (`JWT_SECRET`, database passwords, API keys) must not be written down or stored in plaintext on developer machines.
- Use a password manager for all system credentials.
- Screen sharing sessions (e.g. pair programming) must not display production environment variables.

---

## 7.7 — Clear Desk and Clear Screen
- Developers must lock their screen when away from their workstation.
- No printed copies of credentials, database connection strings, or personal data should be left on desks.
- Browser sessions with production admin access must be closed after use.

---

## 7.8 — Equipment Siting and Protection
**Owner: AWS**
All compute, storage, and database equipment is located in AWS-managed facilities. No physical equipment is maintained by the MayWin team.

---

## 7.9 — Security of Assets Off-Premises
- Developer laptops used off-site must have full-disk encryption enabled (BitLocker / FileVault).
- No production database exports should be stored on laptops.
- If a device is lost: immediately report to Technical Lead → rotate all potentially exposed credentials.

---

## 7.10 — Storage Media
- No removable media (USB drives, external hard drives) should be used to store MayWin data.
- Database backups are stored exclusively in AWS S3 with encryption.
- Development data uses non-production seed data only — see `src/database/seeds/`.

---

## 7.11 — Supporting Utilities
**Owner: AWS**
AWS datacentres maintain redundant power, UPS, and generator systems. The MayWin application benefits from these automatically.

**Application resilience**: The NestJS application is stateless — if an instance fails, it can be restarted immediately without data loss. Database state is persisted in RDS.

---

## 7.12 — Cabling Security
**Owner: AWS**
AWS manages all physical cabling within its datacentres. Network traffic between MayWin components (API → RDS, API → S3) uses AWS private networking (VPC) where possible.

---

## 7.13 — Equipment Maintenance
**Owner: AWS**
AWS performs all hardware maintenance. RDS engine patching is automated — maintenance windows configured in AWS console.

**Application**: Dependencies maintained via `npm update` and `npm audit`. OS-level (Lambda runtime / ECS) patching managed by AWS.

---

## 7.14 — Secure Disposal or Re-Use of Equipment
**Owner: AWS**
AWS uses NIST 800-88 compliant data destruction procedures for decommissioned hardware. MayWin data stored in AWS services is covered by this policy.

**Development machines**: When decommissioning a developer workstation, perform a secure wipe of the storage medium (full-disk encryption + cryptographic erase or physical destruction).

---

## Summary
All physical controls (7.1–7.14) are implemented at the infrastructure level by AWS. MayWin's responsibilities are limited to logical access controls, developer workstation security, and ensuring the AWS configuration (encryption, Multi-AZ, private networking) is correctly applied.

AWS compliance certifications: [aws.amazon.com/compliance/programs](https://aws.amazon.com/compliance/programs/)
