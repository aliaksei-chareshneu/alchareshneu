FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN python -m pip install --no-cache-dir -r requirements.txt
COPY app.py .
RUN adduser --system --group --home /app appuser && mkdir -p /data && chown appuser:appuser /data
USER appuser
ENV PORT=8000 PYTHONUNBUFFERED=1 DB_PATH=/data/imperion_linkedin.sqlite
EXPOSE 8000
CMD ["uvicorn", "app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "127.0.0.1"]
