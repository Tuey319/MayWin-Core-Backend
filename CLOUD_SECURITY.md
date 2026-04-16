# Cloud Services Security Policy

**Control**: ISO/IEC 27002 A.5.23

This document outlines the security requirements for using cloud services (specifically AWS) with the MayWin Core Backend.

## 1. Authentication and Authorization
- **IAM Roles**: The backend, when deployed on AWS (e.g., on EC2 or ECS), must use an IAM Role with the minimum necessary permissions (least privilege).
- **Permissions**:
  - For S3 artifact storage (`MAYWIN_ARTIFACTS_BUCKET`), the role only needs `s3:PutObject` and `s3:GetObject` permissions on the specified bucket and prefix (`MAYWIN_ARTIFACTS_PREFIX`).
  - For Step Functions orchestration (`SCHEDULE_WORKFLOW_ARN`), the role only needs the `states:StartExecution` permission for the specified state machine ARN.
- **Credentials**: IAM user access keys must not be used. All credentials must be managed via environment variables or injected by the cloud environment (e.g., EC2 instance metadata).

## 2. Data Protection
- **Storage**: The S3 bucket used for artifacts (`MAYWIN_ARTIFACTS_BUCKET`) must not be publicly accessible. Bucket policies should enforce this.
- **Encryption at Rest**: Server-Side Encryption (e.g., SSE-S3) should be enabled on the S3 artifact bucket.
- **Encryption in Transit**: All communication between the backend and AWS services must use TLS. The AWS SDK handles this by default.

## 3. Configuration
- Cloud-specific configuration like ARNs and bucket names must be loaded from environment variables, as validated by `validate-env.js`.
- The application must be resilient to transient cloud service failures and log errors appropriately.

## 4. Monitoring
- API calls made to AWS services should be logged via AWS CloudTrail for auditing and security analysis.
- Alarms should be configured in Amazon CloudWatch for unusual activity, such as a high rate of `AccessDenied` errors or unexpected `StartExecution` failures.