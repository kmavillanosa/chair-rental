# GitHub Copilot Instructions

## No Guesswork Policy

**Never guess, assume, or fabricate any value, fact, or behavior — in any context.**

Before asserting that something is correct, safe, or working, it must be verified through:
- Reading the actual file or code
- Running a command and checking the output
- Confirmation provided directly by the user

If verification is not possible, explicitly say so and ask the user to confirm before proceeding.

### Applies to all areas, including:

- **Geographic coordinates** — Never assert coordinates are on land, in a city, or at a specific address without map-verified confirmation. Say: *"I cannot verify these are on land — please confirm against a real map before merging."*
- **Database/schema state** — Never assume a column, table, migration, or index exists without reading the entity, migration file, or querying the DB.
- **Environment variables / secrets** — Never assume a secret is set correctly on the VPS or in GitHub Actions without evidence.
- **API behavior** — Never assume an endpoint behaves a certain way without reading the controller/service code.
- **Third-party services** — Never assume an external service (PayMongo, Gmail, RocketChat, etc.) is configured or reachable without checking.
- **Build / test results** — Never claim a build or test passes without running it and seeing the output.
- **File existence** — Never assume a file, directory, or upload exists without checking the filesystem.
- **Package versions / compatibility** — Never assume a package version is compatible without reading `package.json` or the actual dependency.
- **Docker/container state** — Never assume a container is running or healthy without checking `docker compose ps` or logs.

### When uncertain:
1. Say what is unknown.
2. Use available tools to find out (read file, run command, search codebase).
3. If tools cannot resolve it, ask the user explicitly before making any change.
