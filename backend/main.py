from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

import google.generativeai as genai
import os

from pypdf import PdfReader

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document

# -----------------------------
# Setup
# -----------------------------

load_dotenv()

os.makedirs("uploads", exist_ok=True)
uploaded_files = [
    f for f in os.listdir("uploads")
    if f.endswith(".pdf")
]
os.makedirs("vectorstore", exist_ok=True)

genai.configure(
    api_key=os.getenv("GEMINI_API_KEY")
)

model = genai.GenerativeModel("gemini-2.5-flash")

embeddings = GoogleGenerativeAIEmbeddings(
    model="models/gemini-embedding-001"
)

vectorstore = None
# -----------------------------
# Load existing vectorstore
# -----------------------------

if (
    os.path.exists("vectorstore/index.faiss")
    and os.path.exists("vectorstore/index.pkl")
):
    try:
        vectorstore = FAISS.load_local(
            "vectorstore",
            embeddings,
            allow_dangerous_deserialization=True
        )
        print("✅ Vectorstore loaded successfully")

    except Exception as e:
        print("❌ Error loading vectorstore:", e)

# -----------------------------
# FastAPI
# -----------------------------

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Models
# -----------------------------

class ChatRequest(BaseModel):
    message: str

# -----------------------------
# Routes
# -----------------------------

@app.get("/")
def home():
    return {
        "message": "Backend is running successfully!"
    }

# -----------------------------
# Normal Gemini Chat
# -----------------------------

@app.post("/chat")
def chat(request: ChatRequest):

    response = model.generate_content(
        request.message
    )

    return {
        "response": response.text
    }

# -----------------------------
# RAG Chat
# -----------------------------

@app.post("/rag-chat")
def rag_chat(request: ChatRequest):

    global vectorstore

    if vectorstore is None:
        return {
            "response": "Please upload a document first.",
            "sources": []
        }

    docs = vectorstore.similarity_search(
        request.message,
        k=3
    )



    for i, doc in enumerate(docs):
        print(f"\n--- DOC {i+1} ---")
        print(doc.page_content[:300])

    context = "\n\n".join(
        [doc.page_content for doc in docs]
    )

    sources = []

    for doc in docs:

        source = doc.metadata.get(
            "source",
            "Unknown"
        )

        page = doc.metadata.get(
            "page",
            "?"
        )

        citation = f"{source} - Page {page}"

        if citation not in sources:
            sources.append(citation)

    prompt = f"""
You are a RAG Knowledge Assistant.

Answer ONLY using the provided context.

If the answer is not found in the context, say:

'I could not find this information in the uploaded documents.'

Context:
{context}

Question:
{request.message}
"""

    response = model.generate_content(prompt)

    return {
        "response": response.text,
        "sources": sources
    }
# -----------------------------
# Upload PDF
# -----------------------------

@app.get("/documents")
def get_documents():

    return {
        "documents": uploaded_files,
        "count": len(uploaded_files)
    }


@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...)
):

    global vectorstore

    file_path = f"uploads/{file.filename}"

    if file.filename not in uploaded_files:
        uploaded_files.append(file.filename)

    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    reader = PdfReader(file_path)

    documents = []

    total_characters = 0

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )

    for page_num, page in enumerate(
        reader.pages,
        start=1
    ):

        extracted = page.extract_text()

        if not extracted:
            continue

        total_characters += len(extracted)

        page_chunks = splitter.split_text(
            extracted
        )

        for chunk in page_chunks:

            documents.append(
                Document(
                    page_content=chunk,
                    metadata={
                        "source": file.filename,
                        "page": page_num
                    }
                )
            )

    new_vectorstore = FAISS.from_documents(
        documents,
        embedding=embeddings
    )

    if vectorstore is None:
        vectorstore = new_vectorstore
    else:
        vectorstore.merge_from(
            new_vectorstore
        )

    vectorstore.save_local(
        "vectorstore"
    )

    return {
        "filename": file.filename,
        "characters": total_characters,
        "chunks": len(documents)
    }