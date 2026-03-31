## SMA3

Small personal Next.js app that turns a topic or short brief into an X-compatible post or short thread using OpenAI.

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

- The UI sends the brief to `POST /api/generate`.
- The route uses the OpenAI Responses API and trims each post to stay within 280 characters.
- This is intentionally minimal: no auth, no history, no saved drafts.
