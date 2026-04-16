# Log and Monitoring Policy

**Control**: ISO/IEC 27001:2022 A.8.15, A.8.16

## 1. Purpose
This policy defines the requirements for logging, monitoring, and alerting to detect and facilitate the investigation of security incidents within the MayWin Core Backend.

## 2. Logging Requirements
- **Events to Log**: All security-relevant events must be logged. This includes, but is not limited to:
  - API requests (method, path, status code, response time)
  - Successful and failed authentication attempts
  - Unauthorized access attempts (e.g., JWT validation failures, RBAC denials)
  - Administrative actions (e.g., user role changes)
  - Application errors and exceptions
- **Log Content**: Each log entry must include a timestamp, source IP address, user identifier (if authenticated), and a detailed event description.
- **Implementation**: Application-level logging is implemented via a global interceptor.
  - **Evidence**: `src/common/interceptors/security-logger.interceptor.ts`
- **Data Masking**: Sensitive data such as passwords, API keys, and session tokens must never be written to logs.

## 3. Log Storage and Retention
- **Centralization**: All logs (application, system, cloud) must be forwarded to a centralized logging solution (e.g., AWS CloudWatch Logs) for aggregation and analysis.
- **Protection**: Log files must be protected against unauthorized modification or deletion.
- **Retention**: Security audit logs are retained for 1 year, as specified in `docs/security/DATA_RETENTION_POLICY.md`.

## 4. Monitoring and Alerting
- The Monitoring and Incident Response Team is responsible for reviewing logs and responding to alerts.
- **Key Alerts to Configure**:
  - **Authentication**: >5 failed login attempts for a single user account in 5 minutes.
  - **Access Control**: >10 `403 Forbidden` responses from a single IP address in 1 minute.
  - **Errors**: A sudden spike in `5xx` server error rates.
  - **Cloud**: AWS CloudTrail alerts for critical API calls (e.g., IAM policy changes, security group modifications).

## 5. Review
- Log review shall be performed regularly.
- The list of monitored events and alert thresholds shall be reviewed and updated at least annually to adapt to new threats and application changes.