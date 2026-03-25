# StichCV — LLM & Agent Architecture

## Overview

StichCV uses a **4-node LangGraph pipeline** to tailor resumes. Each node makes one independent LLM call. All calls share a common **provider fallback chain** to avoid rate limits.

---

## Provider Fallback Chain

```
Primary → Gemini 2.5 Flash  (Google AI)
    ↓ (on RateLimitError / 429)
Fallback 1 → Llama-3.3 70B Versatile  (Groq)
    ↓ (on error)
Fallback 2 → Claude 3 Haiku  (OpenRouter)
```

Implemented via LangChain's `.with_fallbacks()` — switching is fully automatic with no user-visible delay beyond the retry latency.

### Provider Configuration

| Provider | Model | Context Window | Rate Limit |
|---|---|---|---|
| Gemini (primary) | `gemini-2.5-flash` | **1,048,576 tokens** (1M) | 15 req/min (free tier: 20/day) |
| Groq (fallback 1) | `llama-3.3-70b-versatile` | 128,000 tokens | ~30 req/min |
| OpenRouter (fallback 2) | `anthropic/claude-3-haiku` | 200,000 tokens | Pay-per-use |

---

## LangGraph Agent Pipeline

```
Input (JD + Master Resume)
        │
        ▼
┌─────────────────┐
│  1. analyze_jd  │  → extracts title, keywords, experience requirements
└────────┬────────┘
         │
         ▼
┌──────────────────────────┐
│  2. retrieve_experiences │  → semantic search in pgvector (top-k=10)
└────────┬─────────────────┘
         │
         ▼
┌────────────────┐
│  3. draft_resume│  → re-writes all bullet points, summary, and skills
└────────┬───────┘
         │
         ▼
┌────────────────┐
│  4. score_resumes│  → ATS scores for both original and tailored resume
└────────────────┘
         │
         ▼
   SSE Result → Frontend
```

> **Note:** The graph also includes a **pre-pipeline** call (`parse_resume_to_json`) that converts the uploaded PDF/text into structured JSON before the pipeline starts.

---

## LLM Call Details & Context Window Usage

### Pre-Pipeline: `parse_resume_to_json`

**Purpose:** Convert raw resume text (from PDF/DOCX) into structured JSON.

| Parameter | Value |
|---|---|
| Temperature | `0.1` (near-deterministic) |
| max_retries | `1` |
| System prompt | ~30 tokens |
| User prompt (static schema) | ~200 tokens |
| **User input (resume text)** | ~500–2,000 tokens (1–4 page resume) |
| **Estimated total input** | **~750–2,250 tokens** |
| **Expected output** | ~800–2,500 tokens (JSON) |

---

### Node 1: `analyze_jd`

**Purpose:** Extract job title, must-have keywords, and required experience from the JD.

| Parameter | Value |
|---|---|
| Temperature | `0.1` |
| max_retries | `1` |
| System prompt | ~20 tokens |
| **User input (JD text)** | ~300–1,500 tokens (typical JD) |
| **Estimated total input** | **~400–1,600 tokens** |
| **Expected output** | ~150–300 tokens (small JSON) |

---

### Node 2: `retrieve_experiences` *(No LLM call)*

**Purpose:** Semantic vector search against pgvector using extracted keywords.

| Parameter | Value |
|---|---|
| LLM used | ❌ None — pure vector DB query |
| Search query | Extracted keywords joined as string (~50–100 chars) |
| `k` (top results) | `10` chunks |
| Filter | `resume_id` (only searches the uploaded resume's vectors) |
| **Output passed forward** | Retrieved text chunks (~1,000–3,000 tokens) |

---

### Node 3: `draft_resume` *(Largest Call)*

**Purpose:** Re-write the resume to match the JD while preserving all original structure.

| Parameter | Value |
|---|---|
| Temperature | `0.2` (slightly creative for phrasing) |
| max_retries | `1` |
| System prompt | ~25 tokens |
| Static JSON schema example | ~200 tokens |
| Critical instructions | ~120 tokens |
| **JD analysis (from Node 1)** | ~150–300 tokens |
| **Retrieved context (from Node 2)** | ~1,000–3,000 tokens |
| **Full master resume JSON** | ~1,000–4,000 tokens (all jobs + projects) |
| **Estimated total input** | **~2,500–7,500 tokens** |
| **Expected output** | ~1,500–4,000 tokens (full resume JSON) |

> ⚠️ **This is the heaviest call.** A resume with 4 jobs + projects + education can easily reach **5,000–7,500 input tokens** combined with the retrieved context.

---

### Node 4: `score_resumes`

**Purpose:** Score original vs tailored resume against the JD on 4 ATS metrics.

| Parameter | Value |
|---|---|
| Temperature | `0.0` (fully deterministic scoring) |
| max_retries | `1` |
| System prompt | ~20 tokens |
| Score schema | ~100 tokens |
| **JD analysis** | ~150–300 tokens |
| **JD text (truncated)** | `[:1000]` chars → ~250 tokens |
| **Original resume JSON** | ~1,000–4,000 tokens |
| **Tailored resume JSON (output of Node 3)** | ~1,500–4,000 tokens |
| **Estimated total input** | **~3,000–8,600 tokens** |
| **Expected output** | ~80 tokens (two score objects) |

---

## Total Context Window Budget Per Full Run

| Call | Input Tokens | Output Tokens |
|---|---|---|
| `parse_resume_to_json` | ~750–2,250 | ~800–2,500 |
| `analyze_jd` | ~400–1,600 | ~150–300 |
| `retrieve_experiences` | N/A (vector DB) | N/A |
| `draft_resume` | ~2,500–7,500 | ~1,500–4,000 |
| `score_resumes` | ~3,000–8,600 | ~80 |
| **Total** | **~6,650–19,950 tokens** | **~2,530–6,880 tokens** |
| **Grand total (in+out)** | **~9,180–26,830 tokens** | |

> **% of Gemini 2.5 Flash 1M window used:** 0.9% – 2.7% per run.
> The model is **nowhere near the context limit** — the constraint is the **API rate limit** (20 req/day free tier), not the context size.

---

## Parallel Client Implementations

StichCV has **two** LLM client code paths:

| Path | File | Used By | SDK |
|---|---|---|---|
| **LangChain (active)** | `resume_tailor_graph.py` | Tailor Resume pipeline | `langchain_google_genai`, `langchain_groq`, `langchain_openai` |
| **Native SDK (legacy)** | `gemini_client.py` | (Available but not currently wired to any API route) | `google.genai` (official Gemini SDK) |

The native `GeminiClient` also has a rate limiter and retry logic (tenacity, 3 attempts, exponential backoff), but the LangChain path is what powers the `/api/tailor_resume` endpoint.

---

## Configuration Reference (`config.py`)

```python
gemini_model             = "gemini-2.5-flash"
gemini_requests_per_minute = 15          # enforced locally
groq_api_key             = <from .env>   # fallback 1
openrouter_api_key       = <from .env>   # fallback 2
```

The active Gemini key is selected by `active_gemini_api_key` — it uses `GEMINI_API_KEY` and falls back to `GEMINI_API_KEY_FALLBACK` if the primary is empty.

---

## Optimization Opportunities

| Issue | Impact | Fix |
|---|---|---|
| `score_resumes` sends both full resumes | Doubles input tokens needlessly | Send only skills/summary sections for scoring |
| `retrieve_experiences` top-k=10 | Can retrieve duplicate/irrelevant chunks | Reduce to k=5 with MMR deduplication |
| No prompt caching | Same JD analyzed fresh every run | Cache JD analysis per job posting hash |
| `parse_resume_to_json` runs every upload | Wastes tokens on unchanged resumes | Hash resume content, cache parsed result in DB |
