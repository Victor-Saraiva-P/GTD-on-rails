# Infrastructure Documentation

## 1. Overview

This document defines the technical infrastructure of the project, including the core stack, execution model, deployment strategy, synchronization approach, and CI/CD design.

The system is based on a desktop-first architecture, with a centralized backend and database, prioritizing simplicity, low operational cost, and maintainability.

---

## 2. Core Stack

### Frontend

- **Tauri 2**
- Desktop application built with web technologies
- Lightweight runtime with native operating system integration

### Backend

- **Java + Spring Boot**
- Central application API
- Responsible for data access, synchronization, authentication, and future integrations

### Database

- **PostgreSQL**
- Primary relational database
- Stores the structured data of the application

---

## 3. High-Level Architecture

The system is divided into three main layers:

### 3.1 Desktop Client

Tauri application executed locally on the user machine.

Responsibilities:

- render the user interface
- process keyboard interactions and local UX behavior
- communicate with the backend through HTTP/HTTPS
- support local lightweight caching in future iterations if needed

### 3.2 Central Backend

Spring Boot service executed on the main server machine.

Responsibilities:

- expose application APIs
- validate and process incoming operations
- centralize synchronization between devices
- enforce authentication and authorization
- support future integrations and background operations

### 3.3 Database Layer

PostgreSQL instance connected to the backend.

Responsibilities:

- store application entities
- preserve relational integrity
- support filtering, querying, and history
- act as the single source of truth for structured data

---

## 4. Infrastructure Topology

### Initial topology

- **1 main machine** hosting backend and PostgreSQL
- **desktop clients** connecting to the backend
- local network access by default
- remote access through secure tunneling or future controlled exposure

### Suggested structure

- `desktop app` → runs locally on each client machine
- `spring boot api` → runs on the main server
- `postgres` → runs on the same main server
- `local storage` → filesystem directory for attachments and reference files

---

## 5. Data Synchronization Strategy

Synchronization is based on a **centralized server model**, avoiding direct replication between local databases.

### Adopted approach

- all clients communicate with the same backend
- the backend reads from and writes to a centralized PostgreSQL database
- PostgreSQL acts as the **single source of truth**
- concurrency conflicts are handled at the application layer

### Reasoning

This approach reduces:

- merge complexity across devices
- risks of data corruption
- operational overhead of distributed synchronization
- need for file-based database sync strategies

---

## 6. File Storage Strategy

Attachments and reference materials are not stored directly inside the database.

### Approach

- files are stored in **local server storage**
- the database stores only:
  - file identifier
  - physical/logical path
  - metadata
  - relationship to domain entities

### Benefits

- better database performance
- simpler backup strategy
- lower coupling between structured data and binary files

---

## 7. Execution Model

### Frontend (Tauri)

- distributed as a desktop application
- lightweight binary
- optimized for Linux-first usage
- future builds for other operating systems remain possible

### Backend (Spring Boot)

- runs as an independent service
- packaged as a `.jar`
- can be executed directly or through containers

### Database (PostgreSQL)

- runs as a dedicated service
- persistent data stored in isolated volumes
- backed up periodically

---

## 8. Environment Model

### Development

- frontend and backend run separately
- local PostgreSQL instance for development
- local communication between Tauri app and backend API

### Initial production

- one main server machine hosting:
  - backend application
  - PostgreSQL
  - local attachment storage directory

---

## 9. Deployment Strategy

### Backend execution options

#### Option A — Direct execution

- Java installed on the server
- Spring Boot running as a system service

#### Option B — Containerized execution

- backend in a container
- PostgreSQL in a container or separate service
- orchestration through Docker Compose

### Recommended approach

- **Docker Compose for backend and database**
- Tauri desktop application running locally on client machines

This provides:

- clearer service isolation
- portability
- easier migration to another machine
- simpler operational maintenance

---

## 10. CI/CD Strategy

The project uses CI/CD to validate code changes, generate build artifacts, and automate backend deployment.

### 10.1 Continuous Integration (CI)

CI is responsible for:

- validating frontend changes
- executing backend tests
- verifying build integrity
- preventing broken changes from reaching deployment

### 10.2 Continuous Delivery / Deployment (CD)

CD is applied primarily to the backend.

Expected flow:

1. a new commit or merge to the main branch triggers the workflow
2. GitHub Actions executes the CI pipeline
3. if CI succeeds, the deploy job becomes eligible
4. the deploy job is executed automatically on the main server

---

## 11. Self-Hosted Runner

To support automated deployment on a local machine, the infrastructure uses a **self-hosted runner**.

### Definition

A self-hosted runner is a GitHub Actions agent running on a machine controlled by the project owner.

It:

- stays online and available to receive jobs
- does **not** monitor commits on its own
- receives jobs only when GitHub triggers a workflow and dispatches a matching job

### Role in the architecture

- execute deployment jobs inside the main server
- allow automatic backend delivery without requiring paid cloud infrastructure
- access local containers, files, services, and volumes directly

### Expected behavior

- the runner stays idle and available
- GitHub detects repository events such as `push` or `merge`
- GitHub runs CI
- only if CI succeeds, GitHub sends the deploy job to the self-hosted runner
- if CI fails, deploy is not executed

### Recommended usage

- **GitHub-hosted runners** for validation, testing, and build stages
- **self-hosted runner** on the main server for backend deployment

---

## 12. Workflow Separation

The pipeline should be separated into distinct workflows.

### CI workflow

Responsibilities:

- frontend lint/build/test
- backend test execution
- general validation

### Backend deploy workflow

Responsibilities:

- fetch updated code or artifacts
- rebuild containers
- restart backend services
- keep database data and persistent volumes intact

### Desktop release workflow

Responsibilities:

- build Tauri application
- generate artifacts
- support future release automation for the desktop client

---

## 13. Network and Access

### Local access

- communication over the local network between clients and server

### Remote access

- preference for secure tunneling in early stages
- direct public exposure only if necessary in the future

### Goal

Avoid:

- unnecessary open ports
- premature network/security complexity
- dependency on paid public infrastructure

---

## 14. Security Baseline

### Database

- accessible only by the backend
- never directly exposed to the desktop client
- credentials stored through environment variables or secrets management

### Backend

- centralized authentication
- input validation
- session/token control
- clear separation between development and production configuration

### File storage

- non-predictable internal file naming
- controlled directory organization
- file access mediated by the backend when required

### Pipeline and deployment

- production deploy gated by successful CI
- deploy runner restricted to the main server
- secrets and credentials kept out of source code
- production automation isolated from local development routines

---

## 15. Backup and Recovery

### Database

- periodic PostgreSQL backups
- retention of multiple backup versions

### Files

- periodic copy of the local storage directory

### Objective

Ensure recoverability in case of:

- disk failure
- human error
- data corruption
- failed update or broken deployment

---

## 16. Future Infrastructure Evolution

The chosen architecture allows future expansion toward:

- local cache on the client
- partial offline support
- real-time synchronization through WebSocket
- separation of application server and database server
- S3-compatible external storage
- stronger authentication mechanisms
- centralized logs and observability
- automated desktop releases
- future Tauri auto-update support

---

## 17. Technical Summary

### Defined stack

- **Desktop app:** Tauri 2
- **Backend:** Spring Boot with Java
- **Database:** PostgreSQL

### Defined architecture

- desktop clients connect to a centralized backend
- backend connects to a centralized PostgreSQL database
- files are stored outside the database in local storage
- synchronization is performed through a central server model
- CI validates changes before deployment
- backend deployment is executed automatically through a self-hosted runner on the main server

### Primary infrastructure principles

- operational simplicity
- low cost
- reliability
- centralized synchronization
- maintainability
- safe build and deploy automation
