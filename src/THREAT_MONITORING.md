# Threat Intelligence Policy

**Control**: ISO/IEC 27001:2022 A.5.7

## 1. Purpose
This policy outlines the process for collecting, analyzing, and acting on threat intelligence to protect the MayWin Core Backend from emerging threats and vulnerabilities.

## 2. Scope
This policy applies to threats related to the application's software dependencies, runtime environment, and cloud infrastructure.

## 3. Intelligence Sources
The Security Administrator and DevOps Engineer are responsible for monitoring the following sources for relevant threat intelligence:
- **Software Dependencies**: Public vulnerability databases and advisories for npm packages.
- **Application Framework**: Security bulletins for Node.js and the NestJS framework.
- **Database**: Vulnerability announcements for PostgreSQL.
- **Cloud Provider**: AWS Security Bulletins and best practice updates.

## 4. Process
1.  **Collection**: Threat intelligence is collected through subscriptions to security mailing lists and regular, automated checks.
2.  **Analysis**: When a potential threat is identified, it is analyzed to determine its relevance and potential impact on the MayWin Core Backend.
3.  **Action**: If a threat is deemed credible and applicable, a remediation plan is created and tracked. This may involve patching, configuration changes, or implementing new security controls.
4.  **Dependency Scanning**: As a primary proactive measure, software dependencies are scanned for known vulnerabilities using `npm audit`. This is a mandatory step in the CI/CD pipeline.

**Evidence**: The Backend Engineer's responsibility to run `npm audit` is defined in `docs/security/SECURITY_ROLES.md`. The CI/CD pipeline will be configured to enforce this scan.