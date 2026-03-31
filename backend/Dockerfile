FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy เฉพาะ Python files ใน backend/
COPY app.py auth.py booking.py notifications.py ./

# สร้างโฟลเดอร์สำหรับ database, photos, csv
RUN mkdir -p /app/data /app/photos /app/database

EXPOSE 5000

CMD ["python", "app.py"]