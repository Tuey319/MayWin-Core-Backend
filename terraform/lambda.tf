# Data source for existing Lambda functions
data "aws_lambda_function" "existing" {
  for_each      = toset(var.lambda_function_names)
  function_name = each.value
}

# Data source for existing Lambda execution role
data "aws_iam_role" "lambda_role" {
  name = var.lambda_role_name
}

# IAM Policy for Lambda to access RDS, S3, CloudWatch
resource "aws_iam_role_policy" "lambda_execution_policy" {
  name   = "${var.lambda_role_name}-policy"
  role   = data.aws_iam_role.lambda_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "RDSAccess"
        Effect = "Allow"
        Action = [
          "rds-db:connect"
        ]
        Resource = "arn:aws:rds:${var.aws_region}:${var.aws_account_id}:db:${var.rds_instance_identifier}"
      },
      {
        Sid    = "S3ArtifactsAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.s3_artifact_bucket_name}",
          "arn:aws:s3:::${var.s3_artifact_bucket_name}/*"
        ]
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/*"
      }
    ]
  })
}

# CloudWatch log groups for Lambda functions
resource "aws_cloudwatch_log_group" "lambda_logs" {
  for_each            = toset(var.lambda_function_names)
  name                = "/aws/lambda/${each.value}"
  retention_in_days   = 7

  tags = {
    Name = "${each.value}-logs"
  }
}
