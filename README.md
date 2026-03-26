# StitchCV - Agentic AI Job Application System

An intelligent, modular system that semi-automatically applies to jobs using Gemini Pro for AI capabilities and Playwright for browser automation.

## Features

- 🔍 **Job Discovery** - Scrapes job listings from multiple sources
- 🧠 **AI Analysis** - Uses Gemini Pro to analyze job descriptions
- 📄 **Resume Tailoring** - Automatically adapts your resume for each job
- ✉️ **Cover Letters** - Generates personalized cover letters
- 🤖 **Auto-Apply** - Fills and submits applications with human review
- 📊 **Tracking** - Logs all applications and their statuses

## Quick Start

### 1. Install Dependencies

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install the package
pip install -e ".[dev]"

# Install Playwright browsers
playwright install chromium
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

For local auth, also set:

```bash
FRONTEND_BASE_URL=http://127.0.0.1:5173
APP_BASE_URL=http://127.0.0.1:8000
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

Google OAuth callback URL to register:

```text
http://127.0.0.1:8000/api/auth/oauth/google/callback
```

Frontend origin to allow in Google Cloud Console:

```text
http://127.0.0.1:5173
```

### 3. Set Up Your Profile

Edit the files in `data/`:
- `master_resume.json` - Your complete resume
- `profile.json` - Your preferences (work auth, salary, locations)

### 4. Run StitchCV

```bash
# Discover jobs
stitchcv discover --source linkedin --query "Software Engineer"

# Analyze discovered jobs
stitchcv analyze

# Generate applications (with human review)
stitchcv apply --review
```

## Project Structure

```
stitchcv/
├── agents/          # AI agents for each pipeline stage
├── models/          # Database models
├── services/        # API clients and utilities
├── scrapers/        # Job site scrapers
└── utils/           # Helper functions
```

## Configuration

See `.env.example` for all available configuration options.

## License

MIT
