import os
import shutil
from typing import List
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_chroma import Chroma
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document
from langchain.retrievers import BM25Retriever, EnsembleRetriever, ContextualCompressionRetriever
from langchain.retrievers.document_compressors import FlashrankRerank

# Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHROMA_PATH = os.path.join(BASE_DIR, "chroma_db")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
COLLECTION_NAME = "rag_collection"
SESSIONS_DIR = os.path.join(BASE_DIR, "sessions")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(SESSIONS_DIR, exist_ok=True)

EMBEDDING_MODEL = "nomic-embed-text"
TOP_K = 3 # Optimal for small models like 1B/3B and slow hardware

class RAGService:
    def __init__(self, model_name="llama3.2:latest"):
        self.model_name = model_name
        self.embedding_model = EMBEDDING_MODEL
        self._init_vector_store()

    def _init_vector_store(self):
        self.embeddings = OllamaEmbeddings(model=self.embedding_model)
        self.vector_store = Chroma(
            collection_name=COLLECTION_NAME,
            embedding_function=self.embeddings,
            persist_directory=CHROMA_PATH
        )
        self._refresh_bm25_retriever()

    def _refresh_bm25_retriever(self):
        # Efficiently pull all chunks from Chroma to build BM25 index
        results = self.vector_store.get()
        if results and results["documents"]:
            docs = []
            for i in range(len(results["ids"])):
                docs.append(Document(
                   page_content=results["documents"][i],
                   metadata=results["metadatas"][i]
                ))
            self.bm25_retriever = BM25Retriever.from_documents(docs)
            self.bm25_retriever.k = TOP_K * 2
        else:
            self.bm25_retriever = None

    def process_document(self, file_path: str):
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".pdf":
            loader = PyPDFLoader(file_path)
        elif ext == ".txt" or ext == ".md":
            loader = TextLoader(file_path)
        else:
            raise ValueError(f"Unsupported file type: {ext}")

        documents = loader.load()
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_documents(documents)
        
        # Add metadata to each chunk
        for chunk in chunks:
            chunk.metadata["source_file"] = os.path.basename(file_path)
        
        total_chunks = len(chunks)
        if total_chunks == 0:
            yield 100
            return

        # Add documents in batches to show progress
        batch_size = 5
        for i in range(0, total_chunks, batch_size):
            batch = chunks[i:i+batch_size]
            self.vector_store.add_documents(batch)
            progress = min(100, int(((i + len(batch)) / total_chunks) * 100))
            yield progress
        
        # After processing all chunks, refresh BM25
        self._refresh_bm25_retriever()

    def query(self, question: str, model_name: str = None, stream: bool = False, chat_history: List = None, 
              temperature: float = 0, top_p: float = 0.9, custom_system_prompt: str = None):
        if model_name and model_name != self.model_name:
            self.model_name = model_name
            self._init_vector_store()
        
        llm = ChatOllama(
            model=self.model_name, 
            streaming=stream,
            temperature=temperature,
            top_p=top_p
        )
        
        default_system_prompt = (
            "You are an assistant for question-answering tasks. "
            "If you don't know the answer, say that you don't know. "
            "The answer MUST be exclusively from the provided documents."
        )
        base_prompt = custom_system_prompt if custom_system_prompt else default_system_prompt
        
        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", base_prompt),
                ("human", "Here is retrieved context from documents to aid your answer:\n\n{context}"),
                ("placeholder", "{chat_history}"),
                ("human", "{input}"),
            ]
        )
        
        question_answer_chain = create_stuff_documents_chain(llm, prompt)
        
        # Base retrievers
        chroma_retriever = self.vector_store.as_retriever(search_kwargs={"k": TOP_K * 2})
        
        # Hybrid Search (Ensemble)
        if self.bm25_retriever:
            ensemble_retriever = EnsembleRetriever(
                retrievers=[chroma_retriever, self.bm25_retriever],
                weights=[0.5, 0.5]
            )
        else:
            ensemble_retriever = chroma_retriever
            
        # Re-ranking stage using FlashRank
        compressor = FlashrankRerank()
        compression_retriever = ContextualCompressionRetriever(
            base_compressor=compressor, 
            base_retriever=ensemble_retriever
        )
        
        rag_chain = create_retrieval_chain(compression_retriever, question_answer_chain)
        
        import time
        start_time = time.time()
        
        # Prepare input with chat history
        input_data = {"input": question, "chat_history": chat_history or []}

        if stream:
            return rag_chain.stream(input_data)
        else:
            response = rag_chain.invoke(input_data)
            latency = time.time() - start_time
            sources = []
            for doc in response.get("context", []):
                sources.append({
                    "source": doc.metadata.get("source_file", "Unknown"),
                    "content": doc.page_content[:200] + "...",
                    "relevance_score": doc.metadata.get("relevance_score", 0.0)
                })
            return {
                "answer": response["answer"],
                "sources": sources,
                "performance": {
                    "latency": f"{latency:.2f}s",
                    "chunks": len(sources)
                }
            }

    def list_documents(self) -> List[str]:
        # Get all documents from the collection
        results = self.vector_store.get()
        if not results or not results["metadatas"]:
            return []
        
        # Extract unique filenames from metadata
        filenames = set()
        for meta in results["metadatas"]:
            if meta and "source_file" in meta:
                filenames.add(meta["source_file"])
        
        return sorted(list(filenames))

    def delete_document(self, filename: str):
        # Delete all chunks associated with this filename
        self.vector_store.delete(where={"source_file": filename})
        self._refresh_bm25_retriever()
        
        # Also delete local file if it exists
        file_path = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(file_path):
            os.remove(file_path)

    def clear_database(self):
        if os.path.exists(CHROMA_PATH):
            shutil.rmtree(CHROMA_PATH)
        self._init_vector_store()
        self._refresh_bm25_retriever()

    def list_sessions(self) -> List[str]:
        if not os.path.exists(SESSIONS_DIR):
            return []
        sessions = [f.replace(".json", "") for f in os.listdir(SESSIONS_DIR) if f.endswith(".json")]
        # Sort by modification time (newest first)
        sessions.sort(key=lambda x: os.path.getmtime(os.path.join(SESSIONS_DIR, x + ".json")), reverse=True)
        return sessions

    def load_session(self, session_id: str) -> List[dict]:
        file_path = os.path.join(SESSIONS_DIR, f"{session_id}.json")
        if not os.path.exists(file_path):
            return []
        import json
        with open(file_path, "r") as f:
            return json.load(f)

    def save_session(self, session_id: str, messages: List[dict]):
        import json
        file_path = os.path.join(SESSIONS_DIR, f"{session_id}.json")
        with open(file_path, "w") as f:
            json.dump(messages, f, indent=2)

    def delete_session(self, session_id: str):
        file_path = os.path.join(SESSIONS_DIR, f"{session_id}.json")
        if os.path.exists(file_path):
            os.remove(file_path)
