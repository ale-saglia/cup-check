FROM mcr.microsoft.com/devcontainers/python:1-3.12-bookworm

ARG NODE_MAJOR=22

COPY .devcontainer/requirements.txt /tmp/devcontainer-requirements.txt

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN rm -f /etc/apt/sources.list.d/yarn.list /etc/apt/sources.list.d/yarn*.list /etc/apt/sources.list.d/yarn*.sources \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    curl \
    fonts-liberation \
    fonts-noto-color-emoji \
    gnupg \
    make \
    novnc \
    openbox \
    ripgrep \
    sqlite3 \
    x11vnc \
    xvfb \
  && mkdir -p /etc/apt/keyrings \
  && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
  && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | gpg --dearmor -o /etc/apt/keyrings/githubcli.gpg \
  && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends gh nodejs \
  && npm install -g lighthouse \
  && pip install -r /tmp/devcontainer-requirements.txt \
  && rm /tmp/devcontainer-requirements.txt \
  && ln -sf /usr/bin/chromium /usr/local/bin/google-chrome \
  && ln -sf /usr/share/novnc/vnc.html /usr/share/novnc/index.html \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*
