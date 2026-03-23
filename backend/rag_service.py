import os
import shutil
from typing import List
from langchain_community.document_loaders import PyPDFLoader, TextLoader, UnstructuredMarkdownLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_chroma import Chroma
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document

# Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHROMA_PATH = os.path.join(BASE_DIR, "chroma_db")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
COLLECTION_NAME = "rag_collection"

os.makedirs(UPLOAD_DIR, exist_ok=True)

class RAGService:
    def __init__(self, model_name="llama3.2:latest"):
        self.model_name = model_name
        self._init_vector_store()

    def _init_vector_store(self):
        self.embeddings = OllamaEmbeddings(model=self.model_name)
        self.vector_store = Chroma(
            collection_name=COLLECTION_NAME,
            embedding_function=self.embeddings,
            persist_directory=CHROMA_PATH
        )

    def process_document(self, file_path: str) -> int:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".pdf":
            loader = PyPDFLoader(file_path)
        elif ext == ".txt":
            loader = TextLoader(file_path)
        elif ext == ".md":
            loader = UnstructuredMarkdownLoader(file_path)
        else:
            raise ValueError(f"Unsupported file type: {ext}")

        documents = loader.load()
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_documents(documents)
        
        # Add metadata to each chunk
        for chunk in chunks:
            chunk.metadata["source_file"] = os.path.basename(file_path)
        
        self.vector_store.add_documents(chunks)
        return len(chunks)

    def query(self, question: str, model_name: str = None, stream: bool = False):
        if model_name and model_name != self.model_name:
            self.model_name = model_name
            self._init_vector_store()
        
        llm = ChatOllama(model=self.model_name, streaming=stream)
        
        system_prompt = (
            "You are an assistant for question-answering tasks. "
            "Use the following pieces of retrieved context to answer "
            "the question. If you don't know the answer, say that you "
            "don't know. Use three sentences maximum and keep the "
            "answer concise. "
            "The answer MUST be exclusively from the provided documents."
            "\n\n"
            "{context}"
        )
        
        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", system_prompt),
                ("human", "{input}"),
            ]
        )
        
        question_answer_chain = create_stuff_documents_chain(llm, prompt)
        retriever = self.vector_store.as_retriever(search_kwargs={"k": 5})
        rag_chain = create_retrieval_chain(retriever, question_answer_chain)
        
        if stream:
            return rag_chain.stream({"input": question})
        else:
            response = rag_chain.invoke({"input": question})
            return response["answer"]

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
        
        # Also delete local file if it exists
        file_path = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(file_path):
            os.remove(file_path)

    def clear_database(self):
        if os.path.exists(CHROMA_PATH):
            shutil.rmtree(CHROMA_PATH)
        self._init_vector_store()
