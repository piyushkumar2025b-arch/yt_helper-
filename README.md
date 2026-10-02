# OpenTranscript AI — YouTube Transcriber & Multi-Provider Summarizer

OpenTranscript AI extracts verbatim transcripts from YouTube videos, direct subtitle files (`.vtt`, `.srt`, `.ttml`, `.xml`, `.json`), or pasted text, and synthesizes structured breakdowns, interactive Q&A, deep-dive expansions, a 12-source knowledge graph, 55+ live research portals, and date-grouped Firebase activity history.

---

## Canonical Setup & Development Workflow

This project uses **Node.js (v20+)** and **npm** as its canonical package manager.

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

Configure any of the following server-side keys in `.env` (all keys are optional because the server includes automatic multi-provider fallback and a local extractive engine):

- **AI Providers (`server.ts`)**:
  - `GEMINI_API_KEY`: Google Gemini API (`@google/genai`) for summaries, Q&A, deep dives, and key-idea extraction.
  - `OPENROUTER_API_KEY`: Server-side OpenRouter key for free-tier models (`meta-llama/llama-3.3-70b-instruct:free`, `deepseek/deepseek-r1:free`, `google/gemini-2.0-flash-exp:free`). Users can also supply their own OpenRouter key in the in-app **AI Model & Connected Sources** modal (stored in `sessionStorage`).
  - `GROQ_API_KEY`: Optional Groq LPU fallback (`llama-3.3-70b-versatile`).
  - `OPENAI_API_KEY`: Optional OpenAI fallback (`gpt-4o-mini`).
  - `ANTHROPIC_API_KEY`: Optional Anthropic Claude fallback (`claude-3-5-sonnet-latest`).
- **Search, Research & Media Portals**:
  - `GOOGLE_API_KEY` & `GOOGLE_CSE_ID`: YouTube Data API v3, Google Books API, and Google Custom Search.
  - Additional optional research keys (`TAVILY_API_KEY`, `SERPER_API_KEY`, `BRAVE_API_KEY`, `EXA_API_KEY`, `SEMANTIC_SCHOLAR_API_KEY`, `GITHUB_TOKEN`, `ELEVENLABS_API_KEY`, `DEEPL_API_KEY`) are documented in `.env.example`.
- **Reverse Proxy & Origin Configuration**:
  - `APP_URL` / `PUBLIC_ORIGIN` / `ALLOWED_ORIGINS`: Allowed public origins when deployed behind a reverse proxy.
  - `TRUST_PROXY`: Set to `1` (or `true`) only when running behind a trusted reverse proxy so `req.ip` and `X-Forwarded-Host` are honored safely.

### 3. Run in Development Mode

Starts the Express + Vite middleware server on port `3000`:

```bash
npm run dev
```

### 4. Type-Check & Production Build

```bash
npm run lint
npm run build
npm start
```
