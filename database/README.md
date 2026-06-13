# Database

Migrations in `migrations/` run automatically when Postgres starts via Docker Compose (`docker-entrypoint-initdb.d`).

**Note:** Re-running migrations requires a fresh volume:

```bash
docker compose down -v
docker compose up -d
npm run seed
```

After indexing knowledge documents, optionally add a vector index:

```sql
CREATE INDEX idx_knowledge_chunks_embedding
ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```
