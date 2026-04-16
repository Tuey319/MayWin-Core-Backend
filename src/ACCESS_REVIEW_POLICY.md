# Access Rights Review Policy

**Control**: ISO/IEC 27001:2022 A.5.18

## 1. Purpose
This policy establishes a formal process for periodically reviewing user access rights to information and other associated assets. The goal is to ensure that access is still required for business purposes and that the principle of least privilege is maintained.

## 2. Scope
This policy applies to all user accounts with access to the MayWin Core Backend application and its underlying infrastructure, including application roles and cloud IAM roles.

## 3. Review Process

| Role Type | Review Frequency | Responsible Party |
| :--- | :--- | :--- |
| **Application User Roles** (`NURSE`, `UNIT_MANAGER`, `ORG_ADMIN`) | Quarterly | Security Administrator |
| **Privileged Infrastructure Roles** (DevOps, DBA) | Semi-Annually | Security Administrator |

### 3.1. Procedure
1.  The Security Administrator will generate a comprehensive list of all users and their assigned access rights (e.g., application roles, AWS IAM roles).
2.  The list will be reviewed with relevant department heads or team leads to validate the ongoing business need for each user's access.
3.  For each user, the assigned permissions will be evaluated to ensure they are the minimum required for the user's job function (principle of least privilege).
4.  Any access rights that are no longer required or are deemed excessive will be revoked or adjusted in a timely manner.
5.  The results of each access review, including any changes made, will be documented and retained as an audit record.

**Evidence**: The effectiveness of this policy is supported by the Role-Based Access Control (RBAC) system implemented via the `RolesGuard` (`src/common/guards/roles.guard.ts`), which allows for granular control and modification of access rights.