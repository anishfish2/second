# Full Stack Application

A modern full-stack application with Next.js frontend and FastAPI backend.

## Project Structure

```
├── frontend/          # Next.js application
├── backend/           # FastAPI application
├── package.json       # Root package.json for running both projects
└── README.md         # This file
```

## Quick Start

1. **Install all dependencies:**
```bash
npm run install:all
```

2. **Run both frontend and backend:**
```bash
npm run dev
```

This will start:
- Frontend at http://localhost:3000
- Backend at http://localhost:8000
- API documentation at http://localhost:8000/docs

## Individual Development

### Frontend (Next.js)
```bash
cd frontend
npm run dev
```

### Backend (FastAPI)
```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Technology Stack

### Frontend
- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **ESLint** - Code linting

### Backend
- **FastAPI** - Python web framework
- **Uvicorn** - ASGI server
- **Pydantic** - Data validation

## Features

- ✅ CORS configured for frontend-backend communication
- ✅ Health check endpoint
- ✅ Frontend displays backend connection status
- ✅ Modern UI with Tailwind CSS
- ✅ TypeScript support
- ✅ Hot reload for both frontend and backend
