# StrumCart GitHub/Vercel structure fix

## Why the Vercel error happened
`index.js` imports `./server/routes`, and `server/routes.js` imports `./models`. Those paths only work when the files stay in the `server/` directory next to `index.js`.

## Required repository-root structure
The contents of this folder must be the repository root (do not upload all files from `server/` into the root):

```
index.js
package.json
.env.example
server/
  routes.js
  models.js
  seed.js
public/
  index.html
  app.js
  api.js
  admin.html
  admin.js
  style.css
```

## Put these files on GitHub
1. Download and extract this ZIP on your computer.
2. Use GitHub Desktop (recommended) or clone the repository in VS Code.
3. Copy the extracted contents into the local repository folder, preserving the `server/` and `public/` folders. If prompted, allow these project files to replace the old flat copies. Do not copy `.env` or `node_modules`.
4. Commit and push the changes to the `main` branch.
5. In Vercel, make sure the project Root Directory is the repository root (the directory containing `index.js` and `package.json`). Redeploy the latest commit.

## Vercel environment variables
In Project Settings → Environment Variables, add these for Production:
- `MONGO_URI`: the real MongoDB Atlas connection URI for the StrumCart database.
- `SESSION_SECRET`: a strong random secret generated privately.
- `NODE_ENV`: `production`.

Do not put actual secrets in GitHub or in `.env.example`. `MONGO_URI` must point to a real, reachable MongoDB database. Do not use the local example URI in production.

## Admin account
To seed products and create the first admin, set `MONGO_URI`, `ADMIN_EMAIL`, and a strong `ADMIN_PASSWORD` (12+ characters) in a local `.env` file, then run `npm install` and `npm run seed` once. Do not commit `.env`. Remove `ADMIN_PASSWORD` from local environment after seeding.

## Validation
This archive preserves the project's intended paths. A successful Vercel deployment still depends on a valid MongoDB URI, a configured session secret, and the correct Vercel project root. Check Vercel Runtime Logs after redeploying if another error appears.
