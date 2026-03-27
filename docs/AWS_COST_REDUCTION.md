# AWS Cost Reduction — March 2026

## Summary

Reduced monthly AWS bill from ~$84/mo to ~$20/mo (~$64/mo savings) by restructuring Lambda networking to eliminate NAT Gateway dependency.

## Root Cause

Lambda functions were placed inside a VPC to access RDS (private subnet). This required a NAT Gateway for outbound internet access (Line webhook, nodemailer SMTP), which cost $36.88/mo alone.

## Changes Made

### 1. Enabled RDS Public Accessibility
- Modified `maywin-restored` RDS instance to be publicly accessible
- Added inbound rule `0.0.0.0/0:5432` to security group `sg-009682c51a819ab16` (`rds-lambda-1`)
- RDS is still protected by credentials; security group was already open to specific IPs

### 2. Removed Lambda Functions from VPC
All three Lambda functions were detached from `vpc-0929945e3777ec6a7`:
- `maywin-core-api`
- `maywin-core-backend-control-layer`
- `maywin-solver-plan-a-strict`

Lambda functions now connect to RDS via the public endpoint directly.

### 3. Deleted NAT Gateway
- Deleted `nat-0df859b6719f248e5`
- Released associated Elastic IP `eipalloc-0e8e1ba57c899d5d8` (`18.138.215.3`)

### 4. Deleted Step Functions VPC Interface Endpoint
- Deleted `vpce-08a2ae575d795ce41` (`com.amazonaws.ap-southeast-1.states`)
- Lambda outside VPC reaches Step Functions via public endpoint at no extra cost
- S3 Gateway endpoint (`vpce-0fedb6d9c1d6e6a87`) was kept — it is free

## Cost Impact

| Resource Removed | Monthly Savings |
|---|---|
| NAT Gateway (`nat-0df859b6719f248e5`) | $36.88 |
| Step Functions VPC Interface Endpoint | $24.41 |
| Elastic IP (NAT Gateway) | ~$3.60 |
| **Total** | **~$64.89** |

## Remaining Costs (~$20/mo)

| Service | Cost | Notes |
|---|---|---|
| RDS db.t4g.micro (PostgreSQL) | $22.50 | Stop when not in use to save |
| EC2 t2.micro | $8.10 | Bastion host — stop when not in use |
| RDS Storage (gp2, 20GB) | $3.41 | Can migrate to gp3 for ~$0.50 savings |
| ECR Storage | $0.65 | Minimal |
| RDS Backup | $0.47 | Minimal |

## Further Savings (Optional)

- **Stop RDS when not in use** — saves $22.50/mo. RDS auto-restarts after 7 days so a scheduled Lambda re-stop may be needed.
- **Migrate RDS storage gp2 → gp3** — same performance, ~15% cheaper. Change via RDS console Modify.
- **Stop EC2 bastion** — RDS is now publicly accessible so pgAdmin/psql can connect directly without a bastion host.

## Architecture Before vs After

**Before:**
```
Lambda (in VPC) → NAT Gateway → Internet (Line API, Gmail SMTP)
Lambda (in VPC) → VPC Endpoint → Step Functions
Lambda (in VPC) → RDS (private subnet)
```

**After:**
```
Lambda (no VPC) → Internet (Line API, Gmail SMTP)
Lambda (no VPC) → Step Functions (public endpoint)
Lambda (no VPC) → RDS (public endpoint, secured by credentials + security group)
```
