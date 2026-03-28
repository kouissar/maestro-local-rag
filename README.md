# Maestro Local Knowledge Base

Maestro is a professional-grade local knowledge system that allows you to chat with your own documents using local LLMs via Ollama. It features a modern interface with advanced hybrid search, AI re-ranking, and session-based history.

![Maestro UI](maestro_ui.png)

## 🚀 Advanced Search Intelligence

Maestro uses a multi-stage retrieval pipeline designed to maximize accuracy even with smaller local models:

1.  **Hybrid Search (Vector + BM25)**: Combines semantic "meaning" search with traditional "keyword" matching. This ensures that technical terms, names, and exact phrases are never missed.
2.  **FlashRank Re-ranking**: After retrieving potential matches, a local, ultra-fast re-ranking model evaluates each chunk for "deep" relevance, passing only the absolute best context to the LLM.

## Features

- **Local Privacy**: All document indexing and chat generation happens on your machine.
- **Session Management**: Track multiple conversations with timestamped session threads.
- **Citations & Sources**: See exactly which document snippets and sources were used to generate every answer.
- **Performance Tracking**: Latency monitors, model details, and token counts.
- **Streaming Responses**: Real-time, token-by-token responses like ChatGPT.

## Prerequisites

- **Python 3.10+** (Recommended)
- **Node.js 18+**
- **Ollama**: [Download Ollama](https://ollama.com/)

## Installation

### 1. Ollama Setup
```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

### 2. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

## Usage

1. Start the backend: `python3 main.py` in `backend/`
2. Start the frontend: `npm run dev` in `frontend/`
3. Access the app at `http://localhost:5173`
