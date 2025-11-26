# mllm-chat-editor

A minimal MVP that turns rich text (mixed text + images) into a multimodal chat prompt for a locally served Qwen 3 VL model via vLLM.

## Project layout
- `backend/`: FastAPI server that converts editor content into an OpenAI-style /chat/completions request and forwards it to vLLM.
- `frontend/`: React + TypeScript UI with a lightweight rich-text editor (contenteditable) that supports mixing text and images.

## Running the backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 9000
```

The backend expects a vLLM OpenAI-compatible server at `http://localhost:8000/v1` and forwards prompts to the `qwen3-vl` model.

## Running the frontend
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. Type text, insert images, and click **Send** to see the model reply in the chat area.
