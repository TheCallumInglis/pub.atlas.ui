# pub.atlas.ui

Frontend for Pub Atlas (React + Vite + TypeScript).

Related API repo: https://github.com/TheCallumInglis/pub.atlas.api

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Docker

```bash
docker build -t pub.atlas.ui:local .
docker run --rm -p 8080:80 pub.atlas.ui:local
```

## CI/CD

On push to `main`:

- lint + build
- semantic-release
- publish image to GHCR:
  - `ghcr.io/thecalluminglis/pub.atlas.ui:<version>`
  - `ghcr.io/thecalluminglis/pub.atlas.ui:latest`