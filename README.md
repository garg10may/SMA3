## SMA3

Small personal Next.js app that turns a topic or short brief into:

- three X-compatible post or thread variants
- one Medium-ready article with an optional lead image
- one AI-generated vertical short with upload copy and a reusable prompt pack

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local env file:

```bash
cp .env.example .env.local
```

3. Add your OpenAI API key to `.env.local`.

4. Start the development server:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Environment

- `OPENAI_API_KEY`: required server-side API key.
- `OPENAI_MODEL`: optional model override. Defaults to `gpt-5-mini`.

## Notes

- X and Medium use `POST /api/generate`.
- Shorts use the separate `POST /api/generate-short` route and stream downloads from `GET /api/generate-short/download`.
- The short generator uses a cost-aware default of `sora-2`, portrait `720x1280`, and `8` seconds.
- Each X post is trimmed to stay within 280 characters.
- This is intentionally minimal: no auth, no history, no saved drafts.
