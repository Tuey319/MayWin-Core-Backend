# NewStart Scheduling System — Backend Overview

This document describes the backend architecture of the NewStart Scheduling System based on the current system design.

The backend is split into two main layers:

1. **Backend for Frontend (BFF)** – a Node.js/Next.js layer that serves the web application and exposes UI-friendly APIs.
2. **Core Backend** – a NestJS + Python–based engine that runs the NLU, scheduling solver, and evaluation pipelines against a central PostgreSQL database.

A reverse proxy sits in front of both layers and also receives webhooks from the LINE OA chatbot.

---

## 1. High-Level Architecture

Main components shown in the architecture diagram:

- **Web Application (Next.js)** for Head Nurses and NewStart Admins
- **LINE OA Chatbot** for nurses
- **Backend for Frontend (BFF)** running on an EC2 instance with:
  - Next.js application
  - Node.js middleware (CRUD APIs, authentication, rate limiting)
  - Docker Compose for service orchestration
- **Reverse Proxy** (e.g. NGINX) routing traffic from the web app and LINE webhook to the backend services
- **Core Backend** running on a separate EC2 instance with Docker Compose:
  - **NestJS API** (HTTP interface for internal and external services)
  - **Rasa API** (NLU for chatbot messages)
  - **Manager service** with Python workers:
    - Normalization worker
    - Model building worker
    - Evaluation / KPI worker
  - **Solver Engine** with Python workers:
    - CP-SAT solver worker (Plan A)
    - Gurobi solver worker (Plan B)
- **Database**:
  - AWS RDS (PostgreSQL)
  - Accessed by the Core Backend services
  - Managed via Docker tooling during development

---

## 2. Backend for Frontend (BFF)

The BFF is the entry point for all browser-based clients.

### Responsibilities

- Serve the **Next.js web application** (Head Nurse and Admin UI).
- Expose **UI-oriented REST APIs** that aggregate data from the Core Backend.
- Handle **authentication** and **authorization** for web users.
- Apply **rate limiting** and basic request validation.
- Act as a single, stable contract for the frontend even if internal Core Backend services change.

### Runtime Environment

- Runs on an **EC2 instance**.
- All services (Next.js app, BFF middleware, helpers) are managed using **Docker Compose**.
- Communicates with the Core Backend through the **reverse proxy** over HTTP/HTTPS.

---

## 3. LINE OA Chatbot Integration

Nurses interact with the system via LINE.

### Flow

1. Nurse sends a message to the **LINE OA chatbot**.
2. LINE forwards the message to the **webhook endpoint** exposed through the reverse proxy.
3. The reverse proxy routes the request to the **Core Backend (Rasa API)**.
4. Rasa interprets the intent and entities from the message.
5. Depending on the intent, the Core Backend may:
   - Query schedules from the database,
   - Trigger a new solver run,
   - Return human-readable responses for the chatbot.

The chatbot integration is therefore handled entirely at the backend layer; the web application never talks directly to LINE.

---

## 4. Core Backend

The Core Backend contains all domain logic for scheduling, optimization, and analytics.

### 4.1 NestJS API

- Provides the main **HTTP API** for:
  - BFF calls (e.g., schedule CRUD, solver runs, KPI queries).
  - Internal services (e.g., workers reporting results).
- Enforces:
  - Authentication/authorization for backend-to-backend calls.
  - Input validation.
  - Logging and error handling.
- Orchestrates workflows between workers, Rasa, the Solver Engine, and the database.

### 4.2 Rasa API (NLU)

- Receives webhook requests relayed from the reverse proxy.
- Performs **intent classification** and **entity extraction** on nurse messages.
- Forwards structured intents to the Manager service or NestJS API for further processing.
- Returns message replies that are sent back to nurses via LINE.

### 4.3 Manager Service and Workers

The Manager coordinates the full lifecycle of a schedule.

- **Normalization worker**
  - Cleans and normalizes input data (staff, shifts, constraints).
  - Ensures data is in the correct format for the solver engine.
  - Writes normalized data back to PostgreSQL.

- **Model building worker**
  - Transforms normalized data into the mathematical model for the solver.
  - Constructs decision variables, constraints, and objectives for each plan (Plan A / Plan B).
  - Stores model metadata and configuration in the database.

- **Evaluation / KPI worker**
  - After a solver run finishes, computes KPIs:
    - Coverage statistics
    - Fairness metrics
    - Preference satisfaction, etc.
  - Persists evaluation results to PostgreSQL for review in dashboards.

These workers are implemented in Python and packaged as services under Docker Compose.

### 4.4 Solver Engine

The Solver Engine runs alternative solver plans on the same model.

- **CP-SAT worker (Plan A)**
  - Uses CP-SAT (via OR-Tools) to solve the scheduling problem.
  - Focuses on constraint satisfaction and feasibility.

- **Gurobi worker (Plan B)**
  - Uses Gurobi to solve the same or similar model.
  - Focuses on high-quality solutions and potentially different trade-offs.

Both solver workers:

- Read normalized data and model configuration from PostgreSQL.
- Write schedule assignments and solver logs back to PostgreSQL.
- Notify the Manager / NestJS API when the run is complete.

---

## 5. Database Layer

The system uses **AWS RDS (PostgreSQL)** as the single source of truth for all persistent data.

Typical data categories stored include:

- Organizational data (sites, units, nurses)
- Shift definitions and coverage requirements
- Availability, preferences, and constraints
- Solver runs, models, and solutions
- KPI and evaluation results
- Chatbot-related metadata as needed

During development, a PostgreSQL instance is also managed via Docker (as shown by the Docker Compose icon in the database box), while production uses AWS RDS.

---

## 6. Request & Data Flows (Summary)

### 6.1 Web Scheduling Flow

1. Head Nurse/Admin uses the **Next.js web app**.
2. Browser sends requests to the **BFF**