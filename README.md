# Mail Mind Workspace — Email AI Agent Monorepo

Welcome to the **Mail Mind** workspace. This repository is organized as a full-stack monorepo separating a modern React web dashboard from a Python-powered Email Intelligence Worker. It utilizes offline Machine Learning models for priority triage and the Google Gemini API for calendar sync, threat analysis, and automated email summarization.

```
├── backend/            # Python Email AI Agent Daemon (classification, Gemini, Calendar)
├── frontend/           # Vite + TanStack Start React Dashboard Application
├── package.json        # Root workspace controller scripts
└── README.md           # Workspace guide (this file)
```

---

## 🚀 Key Features

### 1. Offline RandomForest Priority Classification
* **Local Triage Engine**: Integrates a custom Scikit-Learn `RandomForestClassifier` pipeline combined with TF-IDF Vectorization, yielding **93.95% accuracy** on the university email dataset.
* **Unpickler Schema Safety**: Employs a custom preprocessor class (`preprocessing.EmailPreprocessor`) loaded dynamically upon script execution.
* **Confidence Progress Indicator**: Displays real-time prediction confidence percentages (e.g., `91% Confidence`) on the email details card calculated via the model's `predict_proba()` method.

### 2. User-Provided Google Gemini Key Customization
* **Solve Daily Free-Tier Quota Limits**: Avoid shared API key rate limitations (429 errors). Users can paste their personal Gemini API key directly into the dashboard Settings.
* **Free Google AI Studio Integration**: Generates a free personal API key, granting **1,500 free requests per day** (which easily covers university mailbox polling).
* **Robust Cascade System**: If the primary model `gemini-2.5-flash` is rate-limited, the system automatically falls back through `gemini-2.0-flash`, `gemini-2.0-flash-lite`, and `gemini-2.5-pro` before reverting to local keyword summaries.

### 3. Progressive 5-Email Chunked Sync
* **Live Dashboard Insertion**: Fetches IMAP mailboxes and processes them in parallel chunks of 5. As each chunk resolves, the emails instantly render on the dashboard list in real time, avoiding long loading screens.
* **Fail-Safe Persistence**: Saves progress to `localStorage` and `Firestore` after each chunk. If your key hits its quota limit, all previously processed summaries remain saved on your website.

---

## 🛠️ Root Convenience Scripts

You can execute standard operations directly from the root of the project without changing directories:

### 💻 Frontend Web Application
* **Start Dev Server**: `npm run dev` (Runs on `http://localhost:8080/`)
* **Production Build**: `npm run build`
* **Preview Build**: `npm run preview`
* **Linting / Formatting**: `npm run lint` / `npm run format`

### 🐍 Python AI Agent Daemon
* **Install Python Dependencies**: `npm run backend:install`
* **Execute Python Worker**: `npm run backend:run`

---

## 📂 Folder Breakdown

### 💻 `frontend/`
A **Vite + TanStack Start** React web application.
* **Source Code**: Routes, CSS variables, icons, and state hooks live in [frontend/src/](frontend/src/).
* **Subprocess Bridge**: `webmail.functions.ts` handles spawning the virtual environment Python executable to run classification backend tasks.
* **Secrets Configuration**: Environment secrets live in `frontend/.env`.

### 🐍 `backend/`
The **Python Email AI Agent daemon** worker.
* **Main Script**: `backend/main.py` runs a continuous loop polling university webmails, loading the ML classifier, running Gemini analysis, and syncing events.
* **Trained Model**: The unpickled RandomForest pipeline lives in `backend/models/random_forest_tfidf.joblib`.
* **Secrets Configuration**: Environment secrets live in `backend/.env`.

---

## 🚀 Setting Up & Launching Locally

1. **Clone and Install Frontend Dependencies**:
   ```bash
   npm install
   ```
2. **Set up Python Virtual Environment**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate   # On Windows: .venv\Scripts\activate
   npm run backend:install
   ```
3. **Train the ML model**:
   ```bash
   python3 backend/train.py
   ```
4. **Launch Development Environment**:
   ```bash
   npm run dev
   ```

---

## 🌐 Production Hosting Guidelines

When deploying Mail Mind to live servers, keep the following configuration parameters in mind:

### 1. Server Runtimes
* **Node & Python Cohabitation**: The Node.js server actions spawn Python subprocesses to execute classification tasks. Your hosting environment **must support both Node.js and Python runtimes**.
* **Recommended Services**: Render, Heroku, Railway, or a VPS (DigitalOcean Droplet, AWS EC2) are highly recommended. Ephemeral/serverless hostings like Vercel or Netlify do not support launching persistent Python subprocesses out of the box.

### 2. Environment Variables
Ensure the following variable is defined on your hosting platform:
* `PYTHON_PATH`: The absolute path to the Python executable (e.g. `/usr/bin/python3` or your virtual environment binary). The server functions will dynamically fall back to this environment path if `.venv` is missing.
* `GEMINI_API_KEY`: Fallback developer API key for email summaries.
* `NEON_DATABASE_URL`: Connection string for PostgreSQL database.
