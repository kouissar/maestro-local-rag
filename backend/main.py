import os
import requests
import json
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
    sources: list = []

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
    
    def generate():
        try:
            for progress in rag_service.process_document(file_path):
                yield f"{progress}\n"
        except Exception as e:
            yield f"Error: {str(e)}\n"
    
    return StreamingResponse(generate(), media_type="text/plain")

@app.post("/query", response_model=QueryResponse)
async def query_document(request: QueryRequest):
    try:
        result = rag_service.query(request.question, request.model)
        return QueryResponse(answer=result["answer"], sources=result["sources"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query/stream")
async def query_document_stream(request: QueryRequest):
    try:
        def generate():
            import time
            start_time = time.time()
            chunk_count = 0
            tokens_in = 0
            tokens_out = 0
            full_answer = ""
            ans_chunk = None
            
            for chunk in rag_service.query(request.question, request.model, stream=True):
                if "context" in chunk:
                    chunk_count = len(chunk["context"])
                    context_text = "".join([doc.page_content for doc in chunk["context"]])
                    tokens_in = len(context_text) // 4 + 200
                    
                    sources = []
                    for doc in chunk["context"]:
                        sources.append({
                            "source": doc.metadata.get("source_file", "Unknown"),
                            "content": doc.page_content[:200] + "..."
                        })
                    yield f"SOURCE_METADATA:{json.dumps(sources)}\n"
                
                if "answer" in chunk:
                    ans_chunk = chunk.get("answer")
                    text_content = ""
                    if hasattr(ans_chunk, "response_metadata") and ans_chunk.response_metadata:
                        usage = ans_chunk.response_metadata.get("usage", {})
                        if usage:
                           tokens_in = usage.get("prompt_tokens", tokens_in)
                           tokens_out = usage.get("completion_tokens", tokens_out)
                    
                    if isinstance(ans_chunk, str):
                        text_content = ans_chunk
                    elif hasattr(ans_chunk, "content"):
                        text_content = ans_chunk.content
                    else:
                        text_content = str(ans_chunk)
                    
                    full_answer += text_content
                    yield text_content
            
            if tokens_out == 0:
                tokens_out = len(full_answer) // 4
            
            model_size = "Unknown"
            try:
                r = requests.get("http://localhost:11434/api/tags")
                if r.status_code == 200:
                    models_info = r.json().get("models", [])
                    for m in models_info:
                        if m["name"] == request.model:
                            size_gb = m.get("size", 0) / (1024**3)
                            model_size = f"{size_gb:.2f} GB"
                            break
            except:
                pass
                
            latency = time.time() - start_time
            has_telem = ans_chunk and hasattr(ans_chunk, "response_metadata") and ans_chunk.response_metadata.get("usage")
            
            performance = {
                "model": request.model,
                "size": model_size,
                "latency": f"{latency:.2f}s",
                "chunks": chunk_count,
                "tokens_in": f"{tokens_in}" if has_telem else f"~{tokens_in}",
                "tokens_out": f"{tokens_out}" if has_telem else f"~{tokens_out}"
            }
            yield f"\nPERFORMANCE_METRICS:{json.dumps(performance)}\n"
        
        return StreamingResponse(generate(), media_type="text/plain")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models")
async def list_models():
    try:
        response = requests.get("http://localhost:11434/api/tags")
        if response.status_code == 200:
            models = [model["name"] for model in response.json().get("models", [])]
            return {"models": models}
        return {"models": ["llama3.2:latest"]}
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
