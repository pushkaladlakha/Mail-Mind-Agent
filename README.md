# Mail Mind Workspace — Monorepo

Welcome to the structured **Mail Mind** workspace. The repository is organized into a clean monorepo:

```
├── backend/            # Python Email AI Agent Daemon (polling, ML, Gemini, Calendar)
├── frontend/           # Vite + TanStack Start React Dashboard Application
├── package.json        # Root workspace controller scripts
└── README.md           # Workspace guide (this file)
```

---

## 🛠️ Root Convenience Scripts

You can execute standard operations directly from the root of the project without changing directories (`cd`):

### 💻 Frontend Web Application
* **Start Dev Server**: `npm run dev`
* **Production Build**: `npm run build`
* **Preview Build**: `npm run preview`
* **Linting / Formatting**: `npm run lint` / `npm run format`

### 🐍 Python AI Agent Daemon
* **Install Python Dependencies**: `npm run backend:install`
* **Execute Python Worker**: `npm run backend:run`

---

## 📂 Folder Breakdown

### 💻 `frontend/`
This is your **Vite + TanStack Start** React web application.
* **Source Code**: All pages, routes, CSS variables, icons, and state hooks live in [frontend/src/](file:///Users/pushkal/Desktop/lovable-project-4992a40e/frontend/src/).
* **Secrets Configuration**: Environment secrets live in `frontend/.env`.

### 🐍 `backend/`
This is the **Python Email AI Agent daemon** worker.
* **Main Script**: `backend/main.py` runs a continuous loop polling university webmails, loading your custom ML classifier (`ml_classifier.py`), analyzing bodies with Gemini (`ai_analyzer.py`), and scheduling deadlines to Google Calendar (`calendar_sync.py`).
* **Secrets Configuration**: Environment secrets live in `backend/.env`.

---

## 🚀 Setting Up & Launching

1. **Install Frontend Dependencies**:
   ```bash
   cd frontend
   npm install
   ```
2. **Launch Frontend Development Server**:
   ```bash
   npm run dev
   ```
3. **Launch Python Agent**:
   ```bash
   # Inside the backend folder
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r backend/requirements.txt
   python3 backend/main.py
   ```
