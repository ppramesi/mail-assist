FROM postgres:latest

# Update and install dependencies
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      build-essential \
      postgresql-server-dev-all \
      libicu-dev \
      libpam0g-dev \
      zlib1g-dev \
      git \
      curl

# Install pg_vector
RUN cd /tmp && \
    git clone --branch v0.4.4 https://github.com/pgvector/pgvector.git && \
    cd pgvector && \
    make && \
    make install && \
    rm -rf /tmp/pgvector

# Clean up
RUN apt-get remove -y --auto-remove \
      build-essential \
      postgresql-server-dev-all \
      libicu-dev \
      libpam0g-dev \
      zlib1g-dev \
      git \
      curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*