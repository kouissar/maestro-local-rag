# Maestro RAG - Personal Assistant

Maestro RAG is a powerful retrieval-augmented generation (RAG) assistant that allows you to chat with your own documents using local LLMs via Ollama. It features a modern, sleek interface with real-time token streaming and document management capabilities.

## Features

- **Local RAG**: Chat with your PDFs, text files, and markdown documents locally.
- **Streaming Responses**: Real-time, token-by-token responses like ChatGPT.
- **Document Management**: Easily upload, list, and delete documents from your knowledge base.
- **Model Selection**: Switch between different local models hosted on Ollama.
- **Premium UI**: Modern dark-mode interface with glassmorphism and smooth animations.

## Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **Ollama**: [Download and install Ollama](https://ollama.com/)

## Installation

### 1. Ollama Setup

Ensure Ollama is running and you have at least one model pulled:
```bash
ollama pull llama3.2
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

1.  **Convert PDFs (Optional)**: If you have large PDFs, use the `pdf_to_md.py` utility to convert them to `.md` for faster processing.
2.  **Upload Documents**: Use the "Upload Data" button in the sidebar to add PDFs, `.txt`, or `.md` files to your knowledge base.
3.  **Select Model**: Choose your preferred Ollama model from the dropdown in the sidebar.
4.  **Chat**: Type your question in the input field. Maestro will retrieve relevant context from your documents to provide an accurate answer.
5.  **Manage Sources**: View and delete uploaded documents from the sidebar.
