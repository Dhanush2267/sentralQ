# SentralQ - AI-Powered Surveillance Intelligence Platform

SentralQ is an enterprise-grade Surveillance Intelligence Platform designed for deployment in airports, banks, smart cities, universities, and enterprise facilities. This project implements **Phase 1: Engineering Foundation**, establishing a highly scalable Clean Architecture codebase that supports future expansion.

## Future Phases Roadmap

- **Video Upload & Processing**: Scalable pipelines for ingesting and decoding security feeds.
- **Computer Vision**: Object detection (YOLO), Multi-Object Tracking (ByteTrack), and security event detection.
- **AI Investigation Copilot**: Natural language search, agentic investigation, summaries, and reports.
- **Analytics & Alerts**: Real-time dashboards, historical metrics, and webhook alerts.

---

## Workspace Structure

The project has been separated into two independent workspaces to maintain clean boundaries between Frontend and Backend.

```text
sentralq/
├── .env.example            # Environment variables configuration template
├── README.md               # Project documentation
├── backend/                # FastAPI application
│   ├── requirements.txt    # Python dependencies list
│   └── app/                # Clean Architecture backend source code
└── frontend/               # Vite + React + TypeScript + Tailwind CSS
    ├── package.json        # Frontend node packages
    └── src/                # Frontend codebase
```

---

## Backend Framework

The backend is built with **FastAPI** (Python), implementing clean layered architecture:
- **`app/api/`**: Request handlers, route routing, and controller functions.
- **`app/core/`**: Platform configurations, logging, and security.
- **`app/database/`**: PostgreSQL engine, session managers, and base declarative mappings.
- **`app/models/`**: SQLAlchemy entity models.
- **`app/schemas/`**: Pydantic validation schemas.
- **`app/services/`**: Business logic implementations.
- **`app/repositories/`**: Direct DB database queries.
- **`app/middleware/`**: Global CORS configurations and exception handling.

### How to Run the Backend

1. **Install Prerequisites**:
   Ensure you have Python 3.10+ installed.

2. **Navigate to the Backend**:
   ```bash
   cd backend
   ```

3. **Set Up a Virtual Environment**:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   ```

4. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

5. **Set Up Environment Variables**:
   Copy `.env.example` from the root to `backend/.env` and edit configurations.
   ```bash
   cp ../.env.example .env
   ```

6. **Start the Application Server**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

7. **Documentation**:
   Access the interactive Swagger/OpenAPI documentation at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## Frontend Framework

The frontend is built with **React** + **Vite** + **TypeScript** + **Tailwind CSS**:
- **`src/components/`**: Atomic, reusable layout modules (Cards, Buttons, spinners, status items).
- **`src/layouts/`**: Top nav-bar and collapsible responsive dashboard side-navigation structure.
- **`src/pages/`**: Single Page Views.
- **`src/router/`**: Centralized react-router declaration.
- **`src/contexts/`**: Theme configuration (Light/Dark support).
- **`src/services/`**: Centralized Axios API request client.

### How to Run the Frontend

1. **Navigate to the Frontend**:
   ```bash
   cd frontend
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start the Development Server**:
   ```bash
   npm run dev
   ```

4. **Verify Application**:
   Open browser at [http://localhost:5173](http://localhost:5173).
