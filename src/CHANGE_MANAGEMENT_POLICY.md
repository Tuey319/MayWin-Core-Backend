# Change Management Policy

**Control**: ISO/IEC 27001:2022 A.8.32

## 1. Purpose
This policy establishes a formal process for managing all changes to the production environment, including the application, infrastructure, and database. The goal is to minimize the risk of service disruption, security vulnerabilities, and unauthorized modifications.

## 2. Scope
This policy applies to all changes to the production MayWin Core Backend, including:
- Application source code releases.
- Database schema modifications.
- Infrastructure configuration changes (e.g., security groups, IAM roles).
- Updates to environment variables.

## 3. Change Management Process
1.  **Request for Change (RFC)**: All changes must be initiated through a formal RFC, typically a ticket in a project management system (e.g., Jira, GitHub). The RFC must describe the change, its purpose, and the potential impact.

2.  **Testing**: All changes must be successfully deployed and validated in the `Testing (Staging)` environment as defined in `docs/security/ENVIRONMENT_POLICY.md`. This includes functional, performance, and security testing.

3.  **Approval**: Following successful testing, the change must be approved by a designated authority (e.g., Lead Engineer or Change Advisory Board) before deployment to production.

4.  **Deployment**: Approved changes must be deployed to production using the automated CI/CD pipeline. Manual changes to the production environment are strictly prohibited, except for declared emergencies.

5.  **Rollback Plan**: Every RFC must include a documented and tested plan to roll back the change in case of failure.
    - **Evidence**: The `scripts/backup-db.sh` and `scripts/restore-db.sh` scripts are key components of the rollback plan for database changes.

6.  **Emergency Changes**: In the event of a critical incident requiring an emergency change, a streamlined process may be followed. All emergency changes must be documented and reviewed retrospectively within 48 hours.

## 4. Segregation of Duties
The personnel who develop a change must be different from the personnel who approve the change and deploy it to production, where feasible. This enforces the separation of duties as outlined in `docs/security/ENVIRONMENT_POLICY.md`.