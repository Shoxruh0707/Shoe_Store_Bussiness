FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    U2NET_HOME=/home/app/.u2net

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir --retries 5 --timeout 120 -r requirements.txt

RUN useradd --create-home --uid 10001 app \
    && mkdir -p "$U2NET_HOME" \
    && chown -R app:app /app /home/app

USER app

# Cache the default model in the image so production does not need a download
# when the first product photo arrives.
RUN python -c "from rembg import new_session; new_session('u2net')"

COPY --chown=app:app app.py ./

EXPOSE 7000
CMD ["python", "app.py"]
