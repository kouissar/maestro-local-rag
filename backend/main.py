import os
import requests
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from rag_service import RAGService, UPLOAD_DIR

app = FastAPI(title="Ollama RAG API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag_service = RAGService()

class QueryRequest(BaseModel):
    question: str
    model: str = "llama3.2:latest"

class QueryResponse(BaseModel):
    answer: str

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
    
    try:
        num_chunks = rag_service.process_document(file_path)
        return {"filename": file.filename, "status": "processed", "chunks": num_chunks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query", response_model=QueryResponse)
async def query_document(request: QueryRequest):
    try:
        answer = rag_service.query(request.question, request.model)
        return QueryResponse(answer=answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query/stream")
async def query_document_stream(request: QueryRequest):
    try:
        def generate():
            for chunk in rag_service.query(request.question, request.model, stream=True):
                # LangChain retrieval chain stream yields dicts with "answer" or "context"
                if "answer" in chunk:
                    yield chunk["answer"]
        
        return StreamingResponse(generate(), media_type="text/plain")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models")
async def list_models():
    try:
        # Fetch models from local Ollama instance
        response = requests.get("http://localhost:11434/api/tags")
        if response.status_code == 200:
            models = [model["name"] for model in response.json().get("models", [])]
            return {"models": models}
        return {"models": ["llama3.2:latest"]} # Fallback
    except Exception:
        return {"models": ["llama3.2:latest"]}

@app.get("/documents")
async def list_documents():
    try:
        docs = rag_service.list_documents()
        return {"documents": docs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/documents/{filename}")
async def delete_document(filename: str):
    try:
        rag_service.delete_document(filename)
        return {"status": "deleted", "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/clear")
async def clear_db():
    rag_service.clear_database()
    return {"status": "database cleared"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
