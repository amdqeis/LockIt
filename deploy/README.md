# Production deployment

The production workflow runs after CI succeeds for the same commit. It expects `/srv/app/EduQuas`, Docker Compose with `--wait`, the external Docker network `caddy_net`, and an existing `backend/.env`. Configure `DATABASE_URL` for a PostgreSQL server reachable from containers (on Linux, a host database can use `host.docker.internal`), three JWT secrets, and `ALLOWED_ORIGINS` with the public HTTPS origin. Compose overrides `PORT` and `NODE_ENV` for the backend. Never commit the actual environment file.

Use `Caddyfile.example` as a starting point on the existing Caddy server and attach that server to `caddy_net`. Replace the example hostname. Caddy sends `/socket.io/` to the backend; the frontend forwards `/api/` and `/uploads/exams/` to the backend on the internal Docker network. Browser requests and Socket.IO use the same public origin. The frontend's backend URL is embedded at build time; rebuild the frontend if the internal address changes.

## First installation on an empty database

The migration history begins with alterations to existing tables and cannot initialize an empty database. Before the first production deployment, create a dedicated empty PostgreSQL database and build the images:

```sh
docker compose build
docker compose run --rm --no-deps backend node scripts/bootstrap-database.mjs
docker compose up -d --wait --wait-timeout 180
```

The bootstrap refuses databases containing objects, verifies its pinned schema and migration snapshot, creates the schema and verifies it before recording the baseline. It is intentionally a one-time, explicit operation. If it fails after schema creation, stop and inspect the database; do not rerun it against a nonempty database. A future schema or migration change requires reviewing and updating the pinned bootstrap snapshot before using it on a new database.

Subsequent deployments check migration names and checksums before `prisma migrate deploy`. A missing, failed, divergent, or unknown migration history stops deployment for manual investigation. Do not baseline an existing database without first assessing its schema and data. Database migrations can require maintenance windows and backups; image rollback does not reverse schema changes.

The `question_bank_media` and `exam_uploads` named volumes preserve images across container recreation. Back up these volumes together with the database. If an existing installation has files inside a container, copy and verify them before switching to these mounts. Do not prune volumes during deployment.

The CI PostgreSQL database is disposable and uses `prisma db push` to set up integration tests. This does not test the historical migration chain; the one-time bootstrap and subsequent migration guard must also be exercised on a disposable database when changing them.
