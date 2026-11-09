# FApix deployment implementation plan

> **For agentic workers:** Use superpowers:executing-plans for this deployment.

**Goal:** Replace the old server application with this repository and deploy pushes to main using Finext deploy-templates.
**Architecture:** Single Node 24 API/static/WebSocket process in Docker; existing Caddy retains TLS and reverse_proxy 127.0.0.1:3001. Dedicated repository runner game-stage; runtime env at its ~/.envs/game/.env. Fresh SQLite in /opt/game/volumes/api, payments disabled.
**Tech Stack:** Node 24, Docker Compose, GitHub Actions, Caddy, SQLite.
**Spec:** User's explicit replacement/deployment instruction and /Users/anton/Finext/deploy-templates/PROMPT.md (main verified current).

## Global constraints

- main deploy branch, game-stage runner/concurrency, exact five template steps.
- No source mounts, named volumes, build secrets or proxy changes in workflow.
- Existing app and data archived before removal. Local sandbox database is never uploaded.
- Preserve Caddy, Docker and SSH infrastructure. No new SSH key.

## Review focus

- Production requires Node24 SQLite, runtime TS imports and prices.json.
- node UID1000 must write host-path database; .env absent from image/build context.
- Origin/cookies/WSS must work behind existing HTTPS proxy.
- Failed first deployment must leave a recoverable archived previous application.
- Public repository runner deploys trusted pushes to main only; PR checks remain hosted.

### Task 1: Container and workflow

- [x] Add Dockerfile, .dockerignore, docker-compose.yaml and deploy.yaml.
- [x] Verify compose with temporary env without overwriting local .env; build image, exercise API/catalog/static/WSS in isolated container.
- [x] Run application tests and format/build checks; review deployment diff.

### Task 2: Server and first push

- [x] Install dedicated runner with repository registration, service and game-stage label; create protected runtime env and UID1000 data directory.
- [x] Archive old code/config and consistent old SQLite; verify archive before removing old container/volume/releases.
- [x] Commit and push main to trigger workflow; inspect exact Actions run, Docker state and logs.

### Task 3: Public acceptance

- [x] Verify HTTPS assets/API, disabled payments and shared race with two independent browser sessions.
- [x] Verify persisted account across a second actual push/deployment; confirm env cleanup and old application removal.
- [x] Update deployment documentation with actual evidence; stop QA processes/tabs.
