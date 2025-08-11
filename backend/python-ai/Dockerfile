FROM python:3.12.3-slim

WORKDIR /app

ENV UV_PROJECT_ENVIRONMENT="/usr/local/"
ENV UV_COMPILE_BYTECODE=1

COPY pyproject.toml .
COPY uv.lock .
RUN pip install --no-cache-dir uv
RUN uv sync --frozen --no-install-project --no-dev --no-cache

COPY src/agents/ ./agents/
COPY src/core/ ./core/
COPY src/memory/ ./memory/
COPY src/schema/ ./schema/
COPY src/service/ ./service/
COPY src/main.py ./main.py

CMD ["uvicorn", "--host", "0.0.0.0","--port","8000", "main:app"]