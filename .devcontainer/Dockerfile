FROM mcr.microsoft.com/devcontainers/python:1-3.12-bookworm

ARG NODE_MAJOR=22
ARG ACTIONLINT_VERSION=1.7.12

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
  && curl -LsSf https://astral.sh/uv/install.sh | sh \
  && mv /root/.local/bin/uv /usr/local/bin/uv \
  && mv /root/.local/bin/uvx /usr/local/bin/uvx \
  && ACTIONLINT_ARCH="$(dpkg --print-architecture)" \
  && case "$ACTIONLINT_ARCH" in \
    amd64) ACTIONLINT_ARCH="amd64" ;; \
    arm64) ACTIONLINT_ARCH="arm64" ;; \
    *) echo "Unsupported actionlint architecture: $ACTIONLINT_ARCH" >&2; exit 1 ;; \
  esac \
  && ACTIONLINT_ASSET="actionlint_${ACTIONLINT_VERSION}_linux_${ACTIONLINT_ARCH}.tar.gz" \
  && curl -fsSLO "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/${ACTIONLINT_ASSET}" \
  && curl -fsSLO "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/actionlint_${ACTIONLINT_VERSION}_checksums.txt" \
  && grep -F "  ${ACTIONLINT_ASSET}" "actionlint_${ACTIONLINT_VERSION}_checksums.txt" | sha256sum -c - \
  && tar -xzf "$ACTIONLINT_ASSET" actionlint \
  && install -m 0755 actionlint /usr/local/bin/actionlint \
  && rm -f actionlint "$ACTIONLINT_ASSET" "actionlint_${ACTIONLINT_VERSION}_checksums.txt" \
  && ln -sf /usr/bin/chromium /usr/local/bin/google-chrome \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*
