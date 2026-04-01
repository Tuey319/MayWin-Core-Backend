variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "maywin"
}

variable "aws_account_id" {
  description = "AWS Account ID"
  type        = string
}

variable "ecr_repository_name" {
  description = "ECR repository name"
  type        = string
  default     = "maywin-nest-lambda"
}

variable "lambda_function_names" {
  description = "Lambda function names"
  type        = list(string)
  default     = [
    "maywin-core-api",
    "maywin-core-backend-control-layer",
    "maywin-solver-plan-a-strict"
  ]
}

variable "lambda_role_name" {
  description = "Lambda execution role name"
  type        = string
  default     = "maywin-lambda-execution-role"
}

variable "rds_instance_identifier" {
  description = "RDS instance identifier"
  type        = string
  default     = "maywin-restored"
}

variable "rds_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "s3_artifact_bucket_name" {
  description = "S3 bucket for artifacts"
  type        = string
  default     = "maywin-artifacts"
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
