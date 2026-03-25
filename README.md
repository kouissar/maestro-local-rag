# Maestro RAG - Personal Assistant

Maestro RAG is a powerful retrieval-augmented generation (RAG) assistant that allows you to chat with your own documents using local LLMs via Ollama. It features a modern, sleek interface with real-time token streaming and document management capabilities.

![Maestro UI](maestro_ui.png)

## Features

- **Local RAG**: Chat with your PDFs, text files, and markdown documents locally.
- **Citations & Sources**: Collapsible sections listing the specific source documents and text snippets used to generate every answer.
- **Performance Tracking**: Built-in metrics for every response, including latency, model engine + size, context retrieval chunks, and token counts (In/Out).
- **Consistent Embeddings**: Uses a dedicated high-performance embedding model (`nomic-embed-text`) to ensure stability across different chat models.
- **Streaming Responses**: Real-time, token-by-token responses like ChatGPT.
- **Document Management**: Easily upload, list, and delete documents from your knowledge base.
- **Model Selection**: Switch between different local models (like `llama3.2:1b`, `gemma3`, etc.) hosted on Ollama without re-indexing.
- **Premium UI**: Modern dark-mode interface with glassmorphism and smooth animations.

## Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **Ollama**: [Download and install Ollama](https://ollama.com/)

## Installation

### 1. Ollama Setup

Ensure Ollama is running and you have the required models:
```bash
ollama pull llama3.2
ollama pull nomic-embed-text  # Required for consistent embeddings
```

### 2. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

## Usage

### 1. Start the Backend

```bash
cd backend
source venv/bin/activate
python3 main.py
```
The API will be available at `http://localhost:8000`.

### 2. Start the Frontend

```bash
cd frontend
npm run dev
```
The application will be available at `http://localhost:5173`.

### 3. PDF to Markdown Utility

To speed up processing of large PDFs, we provide a utility to convert them to Markdown before ingestion:

```bash
python3 pdf_to_md.py <path_to_pdf> -o <output_path.md>
```
Markdown files are parsed significantly faster and provide cleaner context for the RAG engine.

## How to use

1.  **Prepare Documents**: For the best performance, use the `pdf_to_md.py` utility on large PDF files.
2.  **Upload Data**: Use the "Upload Data" button in the sidebar. Documents are indexed using `nomic-embed-text`.
3.  **Select Model**: Choose your preferred chat engine (e.g., `llama3.2:1b` for speed or `latest` for quality).
4.  **Chat**: Maestro will retrieve the top 3 most relevant context chunks and cite them in the response.
5.  **Review Performance**: Click "Performance Details" on any message to see exact inference metrics.
6.  **Manage Sources**: View or delete sources from the Knowledge Base sidebar. To start completely fresh, use "Clear Workspace".
