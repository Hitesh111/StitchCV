# HireFlow - Agentic AI Job Application System

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

### 3. Set Up Your Profile

Edit the files in `data/`:
- `master_resume.json` - Your complete resume
- `profile.json` - Your preferences (work auth, salary, locations)

### 4. Run HireFlow

```bash
# Discover jobs
hireflow discover --source linkedin --query "Software Engineer"

# Analyze discovered jobs
hireflow analyze

# Generate applications (with human review)
hireflow apply --review
```

## Project Structure

```
hireflow/
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
