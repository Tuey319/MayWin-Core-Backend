# Cloud Security Policy

**Control**: ISO/IEC 27001:2022 A.5.23, A.7.1, A.8.20

## 1. Purpose
This policy defines the security requirements for using cloud services (specifically Amazon Web Services - AWS) to host the MayWin Core Backend.

## 2. Shared Responsibility Model
We acknowledge the AWS Shared Responsibility Model. AWS is responsible for the "security *of* the cloud," while we are responsible for "security *in* the cloud." This policy covers our responsibilities.

## 3. Identity and Access Management (IAM)
- **Principle of Least Privilege**: All IAM users, roles, and policies must be configured with the minimum permissions necessary to perform their function.
- **IAM Roles for EC2**: EC2 instances running the backend application must use IAM Roles for AWS service access (e.g., to S3). Access keys should not be stored on the instances.
- **MFA**: Multi-Factor Authentication must be enabled for all IAM users with access to the production environment.

## 4. Network Security
- **VPC**: All resources must be deployed within a Virtual Private Cloud (VPC).
- **Network Segmentation**: The PostgreSQL database must be deployed in a private subnet, with no direct internet access. The application, running in a public subnet (or behind a load balancer), will be the only resource with a network path to the database.
- **Security Groups**: Security Groups shall be used as a stateful firewall to control traffic.
  - The database security group must only allow inbound traffic on port 5432 from the application's security group.
  - The application security group will allow inbound traffic on the application port (e.g., 3000) from the load balancer.

## 5. Data Protection
- **S3 Bucket Security**: S3 buckets used for backups and job artifacts must:
  - Block all public access.
  - Have server-side encryption (SSE-S3 or SSE-KMS) enabled.
  - Have versioning enabled to protect against accidental deletion.
- **Database Encryption**: The production PostgreSQL database should have encryption at rest enabled.

## 6. Secrets Management
- **Environment Variables**: As per `ENVIRONMENT_POLICY.md`, secrets like `DB_PASSWORD` and `JWT_SECRET` are managed via environment variables injected at runtime.
- **Evidence**: The `scripts/validate-env.js` script checks for the presence of required environment variables at startup, preventing the application from running with an insecure configuration.

## 7. Monitoring
- AWS CloudTrail and AWS Config must be enabled in the production account to log all API activity and track configuration changes. These logs are critical for security audits and incident response.