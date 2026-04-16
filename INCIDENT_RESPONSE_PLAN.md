# Information Security Incident Response Plan

**Control**: ISO/IEC 27002 A.5.24

This plan outlines the initial steps for responding to common security incidents related to the MayWin Core Backend.

## 1. Roles and Responsibilities
- **Incident Coordinator**: The on-call engineer responsible for managing the incident response.
- **Technical Lead**: The subject matter expert for the affected system.

## 2. Incident Response Phases
1.  **Detection & Analysis**: Identify and confirm the incident.
2.  **Containment**: Isolate the affected system to prevent further damage.
3.  **Eradication**: Remove the root cause of the incident.
4.  **Recovery**: Restore the system to normal operation.
5.  **Post-Incident Activity**: Document the incident and implement lessons learned.

## 3. Specific Incident Playbooks

| Incident Type | Detection | Containment Steps | Eradication & Recovery |
| :--- | :--- | :--- | :--- |
| **A. Auth Compromise (Leaked JWT Secret)** | Alert on forged tokens; report of unauthorized access. | 1. Immediately rotate the `JWT_SECRET` environment variable. <br> 2. Redeploy the application to load the new secret. <br> 3. Force all users to log out by invalidating client-side tokens. | Investigate how the secret was leaked. Review access logs for all systems with access to the secret. |
| **B. Suspicious Admin Activity** | Review of audit logs (`SecurityAudit`) shows unexpected privileged actions (e.g., org creation). | 1. Temporarily lock the suspected admin account. <br> 2. Manually review all actions taken by the account. | If malicious, revert changes from database backups. Reset the user's password and require MFA. |
| **C. Database Leak (Backup File Exposed)** | Alert from cloud provider; public discovery of a `.sql` backup file. | 1. Immediately revoke public access to the storage location (e.g., S3 bucket). <br> 2. Delete the exposed file. | Begin password reset procedure for all users. Analyze the data in the leaked backup to determine if PII/PHI was exposed and follow data breach notification procedures. |
| **D. Repeated Backup Failures** | Monitoring alert on the backup cron job. | N/A | Manually run `backup-db.sh` to identify the error (e.g., incorrect password, disk space full). |
| **E. API Outage (DoS Attack)** | High error rates, slow response times, alerts from rate-limiter. | 1. Identify and block the source IP(s) at the network edge (WAF/Firewall). <br> 2. Verify that `ThrottlerModule` is correctly blocking excessive requests. | Scale application resources if the traffic is legitimate. Refine rate-limiting rules. |