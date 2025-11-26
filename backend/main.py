from typing import List, Literal, Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

MODEL_NAME = "qwen3-vl"
VLLM_BASE_URL = "http://localhost:8000/v1"
API_KEY = "EMPTY"

app = FastAPI(title="mllm-chat-editor backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ImageURL(BaseModel):
    url: str = Field(..., min_length=1)


class ContentItem(BaseModel):
    type: Literal["text", "image_url"]
    text: Optional[str] = None
    image_url: Optional[ImageURL] = None

    def to_chat_content(self) -> dict:
        if self.type == "text":
            return {"type": "text", "text": self.text or ""}
        return {"type": "image_url", "image_url": {"url": str(self.image_url.url)}}


class ChatRequest(BaseModel):
    items: List[ContentItem]


class ChatResponse(BaseModel):
    reply: str


async def call_vllm_chat(items: List[ContentItem]) -> str:
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {
                "role": "user",
                "content": [item.to_chat_content() for item in items],
            }
        ],
    }

    headers = {"Authorization": f"Bearer {API_KEY}"}

    async with httpx.AsyncClient(base_url=VLLM_BASE_URL, timeout=60) as client:
        response = await client.post("/chat/completions", json=payload, headers=headers)
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Model server error: {response.text}")

        data = response.json()
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as exc:  # pragma: no cover
            raise HTTPException(status_code=500, detail="Unexpected model response") from exc


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    reply = await call_vllm_chat(request.items)
    return ChatResponse(reply=reply)


@app.get("/")
async def health() -> dict:
    return {"status": "ok"}
