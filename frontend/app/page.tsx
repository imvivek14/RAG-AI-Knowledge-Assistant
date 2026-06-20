"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [question, setQuestion] = useState("");
  const [uploaded, setUploaded] = useState(false);
  const [filename, setFilename] = useState("");
  const [uploading, setUploading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [documents, setDocuments] = useState<string[]>([]);
  const [showDocuments, setShowDocuments] = useState(false);

  const [messages, setMessages] = useState<
    {
      question: string;
      answer: string;
      sources: string[];
    }[]
  >([]);


  useEffect(() => {
    fetchDocuments();
  }, []);
  
  const fetchDocuments = async () => {
    try {
      const response = await fetch(
        "https://rag-ai-knowledge-assistant-z73f.onrender.com/documents"
      );
  
      const data = await response.json();
  
      setDocuments(data.documents || []);
    } catch (error) {
      console.error(error);
    }
  };

  const uploadFile = async () => {
    if (!file) {
      alert("Select a file first");
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        "https://rag-ai-knowledge-assistant-z73f.onrender.com/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      await response.json();

      setUploaded(true);
      setFilename(file.name);

      fetchDocuments();
    } catch (error) {
      console.error("UPLOAD ERROR:", error);
    } finally {
      setUploading(false);
    }
  };

  const askQuestion = async () => {
    if (!question.trim()) return;

    try {
      setThinking(true);

      const response = await fetch(
        "https://rag-ai-knowledge-assistant-z73f.onrender.com/rag-chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: question,
          }),
        }
      );

      const data = await response.json();

      setMessages((prev) => [
        {
          question,
          answer: data.response,
          sources: data.sources || [],
        },
        ...prev,
      ]);

      setQuestion("");
    } catch (error) {
      console.error(error);
    } finally {
      setThinking(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white p-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-2">
          RAG AI Knowledge Assistant
        </h1>

        <p className="text-gray-400 mb-8">
          Upload documents and chat with them using AI.
        </p>

        <div className="bg-gray-900 p-4 rounded-xl mb-6">
  <button
    onClick={() =>
      setShowDocuments(!showDocuments)
    }
    className="font-semibold"
  >
    📚 Knowledge Base ({documents.length})
    {" "}
    {showDocuments ? "▲" : "▼"}
  </button>

  {showDocuments && (
    <div className="mt-4 space-y-2">
      {documents.length === 0 ? (
        <p className="text-gray-400">
          No documents uploaded yet.
        </p>
      ) : (
        documents.map((doc, index) => (
          <div
            key={index}
            className="bg-gray-800 p-2 rounded"
          >
            📄 {doc}
          </div>
        ))
      )}
    </div>
  )}
</div>
        <div className="bg-gray-900 p-6 rounded-xl mb-6">
        <div className="mb-4">
  <label
    htmlFor="pdf-upload"
    className="inline-block bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg cursor-pointer border border-gray-600"
  >
    📄 Choose PDF
  </label>

  <input
    id="pdf-upload"
    type="file"
    accept=".pdf"
    className="hidden"
    onChange={(e) => {
      if (e.target.files?.[0]) {
        setFile(e.target.files[0]);
      }
    }}
  />

  {file && (
    <p className="mt-2 text-green-400">
      Selected: {file.name}
    </p>
  )}
</div>

          <button
            onClick={uploadFile}
            disabled={uploading}
            className="bg-blue-600 text-white px-4 py-2 rounded mt-4 block"
          >
            {uploading ? "Uploading..." : "Upload Document"}
          </button>

          {uploaded && (
            <div className="mt-4 p-4 bg-green-900 rounded">
              ✅ {filename} uploaded successfully
            </div>
          )}
        </div>

        <div className="bg-gray-900 p-6 rounded-xl mb-6">
          <input
            type="text"
            placeholder="Ask a question..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                askQuestion();
              }
            }}
            className="w-full p-3 rounded bg-gray-800 border border-gray-700"
          />

          <button
            onClick={askQuestion}
            disabled={thinking || !uploaded}
            className="bg-black text-white px-4 py-2 rounded mt-4"
          >
            {thinking ? "Thinking..." : "Ask Question"}
          </button>
        </div>

        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="bg-gray-900 p-5 rounded">
              Upload a PDF and ask a question.
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className="space-y-2">
                <div className="bg-blue-900 p-4 rounded">
                  <strong>You:</strong> {msg.question}
                </div>

                <div className="bg-gray-900 p-4 rounded">
                  <strong>AI:</strong>

                  <div className="mt-2 whitespace-pre-wrap">
                    {msg.answer}
                  </div>

                  <div className="mt-4 text-sm text-gray-400">
                    Sources: {msg.sources.join(", ")}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}