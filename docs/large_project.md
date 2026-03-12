
## Integrating into a larger project

If this script is part of a larger project (e.g. a UI repo pointing to a Saleor backoffice), there are several integration options depending on project scale.

### Option 1 — Standalone script (simplest)

Keep this repo separate and run it once per environment. No integration needed in the UI repo:

```bash
# Whenever a new environment needs seeding:
cd ../saleor-script && npm run seed
cd ../my-ui-repo && npm run dev
```

Best for: staging/production environments that are configured once.

---

### Option 2 — `scripts/seed/` inside the UI repo

Move the contents of this repo into a `scripts/seed/` folder inside the UI repo:

```
my-ui-repo/
├── src/                          # UI source code
├── apollo/
│   └── apollo-client.ts          # production Apollo client
├── scripts/
│   └── seed/
│       ├── apollo/
│       │   └── apollo-client.ts  # Node.js-only client for the script
│       ├── mutations/            # same mutations the UI uses
│       ├── seeders/
│       ├── config/
│       │   └── defaults.ts
│       └── index.ts
└── package.json
```

Add a script to the UI repo's `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "seed": "tsx scripts/seed/index.ts",
    "setup": "npm run seed && npm run dev"
  }
}
```

The mutations in `scripts/seed/mutations/` can be the **same files** imported by the UI — no duplication.

---

### Option 3 — Monorepo with shared workspaces (most scalable)

If the project uses a monorepo (Turborepo, pnpm workspaces, Nx):

```
my-project/
├── apps/
│   └── web/                      # UI app
├── packages/
│   └── saleor-seed/              # this repo as a workspace package
│       ├── src/
│       │   ├── mutations/        # shared with apps/web
│       │   └── ...
│       └── package.json
├── package.json                  # "workspaces": ["apps/*", "packages/*"]
└── turbo.json
```

The UI app imports mutations and types directly from the package:

```ts
// apps/web/src/apollo/mutations/productType.ts
import { PRODUCT_TYPE_CREATE } from '@my-project/saleor-seed/mutations/productType';
```

Add a root-level seed script:

```json
{
  "scripts": {
    "seed": "turbo run seed --filter=saleor-seed"
  }
}
```

Best for: multiple apps sharing the same Saleor instance, or when TypeScript types need to be shared across packages.

---

### Option 4 — CI/CD: automatic seed per environment

For ephemeral environments (a new Saleor instance per branch or PR), run the seed automatically in the pipeline before deploying the UI:

```yaml
# .github/workflows/preview.yml
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Seed Saleor instance
        env:
          SALEOR_API_URL: ${{ secrets.SALEOR_API_URL }}
          SALEOR_APP_TOKEN: ${{ secrets.SALEOR_APP_TOKEN }}
        run: npm run seed
      - name: Deploy UI
        run: npm run build && npm run deploy
```

Best for: preview environments, automated QA pipelines, or infrastructure-as-code workflows.

---

### Choosing an option

| Situation | Recommended option |
|---|---|
| Small project / single environment | 1 — standalone script |
| Growing project, want to share types | 2 — `scripts/seed/` inside UI repo |
| Multiple apps sharing one Saleor instance | 3 — monorepo |
| Ephemeral environments per PR/branch | 4 — CI/CD pipeline |

The key advantage of this script's structure is that `src/mutations/` files are written in the exact same format used by Apollo in production — `gql`-tagged documents with TypeScript types — so they can be moved into any UI project and used directly without adaptation.
