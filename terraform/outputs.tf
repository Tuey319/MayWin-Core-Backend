output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = aws_ecr_repository.maywin.repository_url
}

output "ecr_registry_id" {
  description = "ECR registry ID"
  value       = aws_ecr_repository.maywin.registry_id
}

output "lambda_function_arns" {
  description = "Lambda function ARNs"
  value       = {
    for name in var.lambda_function_names :
    name => data.aws_lambda_function.existing[name].arn
  }
}

output "rds_endpoint" {
  description = "RDS endpoint address"
  value       = data.aws_db_instance.existing.endpoint
}

output "s3_artifact_bucket" {
  description = "S3 artifact bucket name"
  value       = aws_s3_bucket.artifacts.id
}

output "lambda_execution_role_arn" {
  description = "Lambda execution role ARN"
  value       = data.aws_iam_role.lambda_role.arn
}
