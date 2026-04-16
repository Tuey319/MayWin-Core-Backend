# Network Security Policy

**Control**: ISO/IEC 27001:2022 A.8.20, A.8.21, A.8.24

## 1. Purpose
This policy defines the controls required to secure the network infrastructure supporting the MayWin Core Backend.

## 2. Network Segmentation
- **VPC**: All cloud resources must be deployed within an AWS Virtual Private Cloud (VPC).
- **Subnets**: The VPC will be segmented into public and private subnets.
  - **Public Subnet**: Contains internet-facing resources like Load Balancers.
  - **Private Subnet**: Contains internal resources, most importantly the PostgreSQL database. The database must not have a public IP address or a direct route to the internet.

## 3. Traffic Control
- **Security Groups**: AWS Security Groups must be used as stateful firewalls to control traffic to and from resources.
- **Default Deny**: Security groups must follow a "default deny" principle. Only traffic that is explicitly required for the application to function should be allowed.
- **Example Rule**: The security group for the PostgreSQL database must only allow inbound TCP traffic on port 5432 from the security group of the application servers. All other inbound traffic must be denied.

## 4. Encryption in Transit
- **TLS**: All data transmitted over public networks (i.e., between the end-user and the application) must be encrypted using Transport Layer Security (TLS) version 1.2 or higher.
- **Enforcement**: TLS termination will be handled at the AWS Application Load Balancer (ALB). The ALB will be configured to redirect all HTTP traffic to HTTPS.

## 5. Network Service Security
- Unused ports on all systems must be disabled.
- Default credentials for any network devices or services must be changed immediately upon deployment.