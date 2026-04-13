# Terraform & CI/CD Setup Guide

This guide covers how to use Terraform to manage MayWin AWS infrastructure and set up automated deployments via GitHub Actions.

## Overview

- **Terraform**: Infrastructure as Code for AWS resources (ECR, Lambda, RDS, S3)
- **GitHub Actions**: Automated build, push to ECR, and Lambda deployment on code push

---

## Prerequisites

### Local Setup
- **Terraform** >= 1.0: [Install](https://www.terraform.io/downloads.html)
- **AWS CLI** >= 2.0: [Install](https://aws.amazon.com/cli/)
- **Docker** with buildx support: [Install](https://docs.docker.com/get-docker/)

### AWS Setup
- AWS Account ID: `556088722017`
- IAM user with permissions (use the `MayWin` group policy)
- AWS credentials configured: `aws configure`

---

## Part 1: Terraform Setup (Local)

### 1. Initialize Terraform

```bash
cd terraform
terraform init
```

### 2. Create `terraform.tfvars`

Copy the example file and fill in your values:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
aws_account_id = "556088722017"
environment    = "prod"
```

### 3. Review and Validate

```bash
# Check for syntax errors
terraform validate

# See what resources Terraform will create/modify
terraform plan
```

### 4. Apply Infrastructure

```bash
# Create/update resources
terraform apply

# Confirm with "yes"
```

### 5. View Outputs

After apply completes:

```bash
terraform output

# Or get specific values:
terraform output ecr_repository_url
terraform output s3_artifact_bucket
```

---

## Part 2: GitHub Actions Setup

### 1. Create GitHub Actions IAM Role

This role allows GitHub Actions to deploy without storing long-lived credentials.

```bash
# Run this AWS CLI command:
aws iam create-role \
  --role-name github-actions-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Federated": "arn:aws:iam::556088722017:oidc-provider/token.actions.githubusercontent.com"
        },
        "Action": "sts:AssumeRoleWithWebIdentity",
        "Condition": {
          "StringEquals": {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
          },
          "StringLike": {
            "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_ORG/MayWin-Core-Backend:*"
          }
        }
      }
    ]
  }'
```

Replace `YOUR_GITHUB_ORG` with your actual GitHub organization/username.

### 2. Attach Permissions to GitHub Actions Role

```bash
aws iam attach-role-policy \
  --role-name github-actions-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser

aws iam attach-role-policy \
  --role-name github-actions-role \
  --policy-arn arn:aws:iam::aws:policy/AWSLambdaFullAccess
```

### 3. Add GitHub Actions Secrets

In your GitHub repo settings:

**Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add:
- `SLACK_WEBHOOK_URL` (optional - for notifications)

Example:
```
https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 4. Workflow Runs Automatically

When you push to `main` or `develop`:

1. ✅ Docker image builds
2. ✅ Pushed to ECR 
3. ✅ Lambda function updates
4. ✅ Slack notification sent

View runs in: **GitHub** → **Actions** tab

---

## Deployment Workflow

### Option A: Automatic (Recommended)

```bash
git add .
git commit -m "feat: add new scheduling endpoint"
git push origin main
# → GitHub Actions automatically builds and deploys
```

### Option B: Manual Deploy

If you need to deploy without code changes:

```bash
aws lambda update-function-code \
  --function-name maywin-core-api \
  --region ap-southeast-1 \
  --image-uri 556088722017.dkr.ecr.ap-southeast-1.amazonaws.com/maywin-nest-lambda:http-latest
```

---

## Terraform Commands Cheatsheet

```bash
# Validate configuration
terraform validate

# Format code
terraform fmt -recursive

# Plan changes (dry-run)
terraform plan

# Apply changes
terraform apply

# Destroy all resources (CAREFUL!)
terraform destroy

# Get specific output
terraform output ecr_repository_url

# Show current state
terraform show

# Import existing resource
terraform import aws_ecr_repository.maywin maywin-nest-lambda
```

---

## State Management (Optional: S3 Backend)

By default, state is stored locally in `terraform.tfstate`. For team collaboration, use S3:

### 1. Create S3 Backend

```bash
# Create bucket
aws s3api create-bucket \
  --bucket maywin-terraform-state-556088722017 \
  --region ap-southeast-1 \
  --create-bucket-configuration LocationConstraint=ap-southeast-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket maywin-terraform-state-556088722017 \
  --versioning-configuration Status=Enabled

# Block public access
aws s3api put-public-access-block \
  --bucket maywin-terraform-state-556088722017 \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

### 2. Uncomment Backend in `provider.tf`

```hcl
backend "s3" {
  bucket         = "maywin-terraform-state-556088722017"
  key            = "prod/terraform.tfstate"
  region         = "ap-southeast-1"
  encrypt        = true
}
```

### 3. Reinitialize

```bash
terraform init
# → Migrate state to S3
```

---

## Troubleshooting

### "Error: error validating provider credentials"

```bash
# Re-configure AWS credentials
aws configure
# Enter Access Key ID, Secret Access Key, Region
```

### "Lambda update failed"

```bash
# Check Lambda status
aws lambda get-function-configuration \
  --function-name maywin-core-api \
  --region ap-southeast-1

# Check logs
aws logs tail /aws/lambda/maywin-core-api --follow
```

### ECR image push fails

```bash
# Re-login to ECR
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin 556088722017.dkr.ecr.ap-southeast-1.amazonaws.com
```

---

## Next Steps

1. ✅ Set up Terraform locally
2. ✅ Configure GitHub Actions
3. ✅ Push a test commit to trigger the workflow
4. ✅ Monitor the deployment in GitHub Actions tab
5. ✅ (Optional) Set up S3 backend for team collaboration
6. ✅ (Optional) Add Slack notifications

---

## Files Reference

| File | Purpose |
|------|---------|
| `terraform/provider.tf` | AWS provider configuration |
| `terraform/variables.tf` | Input variables |
| `terraform/ecr.tf` | ECR repository setup |
| `terraform/lambda.tf` | Lambda IAM roles & logs |
| `terraform/rds.tf` | RDS monitoring & alarms |
| `terraform/s3.tf` | S3 artifact bucket |
| `terraform/outputs.tf` | Outputs (URLs, ARNs) |
| `.github/workflows/deploy.yml` | GitHub Actions CI/CD pipeline |
| `terraform.tfvars` | Environment-specific values (DO NOT COMMIT) |

