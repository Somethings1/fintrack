FROM mongo:7.0
USER root
RUN apt-get update && apt-get install -y --no-install-recommends python3 age ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/fintrack
COPY scripts/backup.py scripts/backup.py
COPY deploy/backup/inventory.js deploy/backup/inventory.js
USER 65532:65532
ENTRYPOINT ["python3", "/opt/fintrack/scripts/backup.py"]
