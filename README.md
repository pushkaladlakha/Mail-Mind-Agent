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

Mail Mind is designed as a **decoupled application** for production hosting. The frontend runs as a serverless web app on **Vercel**, and the Python intelligence engine runs as a web service + background polling daemon on **Render**.

---

### 1. 🐍 Python Backend (Render Web Service)

Deploy the `backend` folder to **Render** as a **Web Service**:

* **Root Directory:** `backend`
* **Build Command:** `pip install -r requirements.txt`
* **Start Command:** `python -m uvicorn api:app --host 0.0.0.0 --port $PORT`
* **Environment Variables on Render:**
  * `NEON_DATABASE_URL`: Connection string to your Neon PostgreSQL database (used for checking already processed email UIDs and logs).
  * `GEMINI_API_KEY`: Fallback developer API key for email summaries.
  * `IMAP_USER` / `IMAP_PASSWORD`: Credentials for the background continuous email polling loop. *(Leave empty if you want to disable background daemon polling and only allow manual user syncs on the website).*
  * `GOOGLE_CREDENTIALS_JSON_CONTENT`: A raw string of your `credentials.json` file. Allows Google Calendar integration without writing static credential files.
  * `GOOGLE_TOKEN_JSON_CONTENT`: A raw string of your generated `token.json` file. Allows background Google OAuth2 authentication in headless cloud environments (first run `python backend/calendar_sync.py --auth` locally to generate your token).

---

### 2. 💻 React Frontend (Vercel Web App)

Deploy the `frontend` folder to **Vercel** as a **Web Project**:

* **Root Directory:** `frontend`
* **Framework Preset:** Select **Other** (allows Nitro to configure Vercel output).
* **Build Command:** `npm run build`
* **Environment Variables on Vercel:**
  * `BACKEND_API_URL`: Set to your live Render backend URL (e.g. `https://mail-mind-agent.onrender.com`).
  * `NITRO_PRESET`: Set to `vercel`.

