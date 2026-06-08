FROM python:3.11-slim

# Install Node.js
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Node deps first (cached layer)
COPY mini-app/package.json mini-app/package-lock.json* ./mini-app/
RUN cd mini-app && npm install

# Copy rest of app (sources + everything)
COPY . .

# Build mini-app LAST so dist/ isn't overwritten by stale committed files
RUN cd mini-app && npm run build

EXPOSE 8080
CMD uvicorn api:app --host 0.0.0.0 --port $PORT
