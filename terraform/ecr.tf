# ECR Repository for Docker images
resource "aws_ecr_repository" "maywin" {
  name                 = var.ecr_repository_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = var.ecr_repository_name
  }
}

# ECR lifecycle policy to clean up old images
resource "aws_ecr_lifecycle_policy" "maywin" {
  repository = aws_ecr_repository.maywin.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus     = "any"
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# ECR Registry Authorization Token (for pulling images)
resource "aws_ecr_registry_authorization_token" "token" {
}

output "ecr_auth_token" {
  description = "ECR authorization token"
  value       = aws_ecr_registry_authorization_token.token.authorization_token
  sensitive   = true
}
