SHELL := /bin/bash

WEB_DIR := packages/web
PYTHON_DIR := packages/cup_check
DATA_DIR := data
WEB_PORT ?= 5173
WEB_PREVIEW_PORT ?= 4173
DATASET_SNAPSHOT_DATE ?= $(shell date -u +%Y-%m-01)

.DEFAULT_GOAL := help

.PHONY: help
help: ## Mostra i comandi disponibili
	@awk 'BEGIN {FS = ":.*##"; printf "\nComandi disponibili:\n"} /^[a-zA-Z0-9_.-]+:.*##/ {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: setup
setup: web-install python-install ## Installa le dipendenze di sviluppo

.PHONY: check
check: web-lint web-test web-build web-audit python-lint python-test ## Esegue tutte le verifiche locali veloci

.PHONY: release-check
release-check: check web-acceptance web-acceptance-chrome-legacy web-lighthouse ## Esegue le prove browser/Lighthouse; acceptance sia con Chromium moderno che con quello legacy

.PHONY: web-install
web-install: ## Installa le dipendenze del package web
	cd $(WEB_DIR) && npm install

.PHONY: web-dev
web-dev: ## Avvia Vite in sviluppo
	cd $(WEB_DIR) && npm run dev -- --port $(WEB_PORT)

.PHONY: web-preview
web-preview: web-build ## Builda e serve la preview statica Vite
	cd $(WEB_DIR) && npm run preview -- --port $(WEB_PREVIEW_PORT)

.PHONY: web-preview-dataset
web-preview-dataset: web-build ## Builda e serve la preview includendo il dataset locale in dist/dataset
	node scripts/prepare_web_preview_dataset.mjs
	cd $(WEB_DIR) && npm run preview -- --port $(WEB_PREVIEW_PORT)

.PHONY: web-lint
web-lint: ## Esegue ESLint sul package web
	cd $(WEB_DIR) && npm run lint

.PHONY: web-test
web-test: ## Esegue i test Vitest una volta
	cd $(WEB_DIR) && npm test -- --run

.PHONY: web-test-watch
web-test-watch: ## Esegue i test Vitest in watch mode
	cd $(WEB_DIR) && npm test

.PHONY: web-acceptance
web-acceptance: web-build ## Verifica upload XLSX 10k e offline PWA con Chromium
	cd $(WEB_DIR) && npx playwright install chromium
	cd $(WEB_DIR) && npm run test:acceptance

.PHONY: web-lighthouse
web-lighthouse: web-build ## Verifica soglie Lighthouse MVP sulla build statica
	cd $(WEB_DIR) && npx playwright install chromium
	cd $(WEB_DIR) && npm run test:lighthouse

# Chromium 109 (revision 1069273 ≈ Chrome 109.0.5414) — installato via @puppeteer/browsers.
# Chrome for Testing parte dalla versione 113, quindi si usa lo snapshot Chromium corrispondente.
CHROMIUM_LEGACY_REVISION := 1069273
CHROMIUM_LEGACY_INSTALL  := npx -y @puppeteer/browsers install chromium@$(CHROMIUM_LEGACY_REVISION) --path $(HOME)/.cache/puppeteer --format '{{path}}'
# Flag necessari in ambienti container senza GPU reale né dbus:
#   --disable-gpu            evita l'avvio del processo GPU (elimina gli errori viz/command-buffer/dri3)
#   --disable-dev-shm-usage  usa /tmp invece di /dev/shm (evita crash con shm piccola in Docker)
#   --disable-features=MediaRouter  disabilita il Media Router che tenta di connettersi a dbus
CHROMIUM_LEGACY_FLAGS    := --no-sandbox --no-first-run --no-default-browser-check \
                             --disable-gpu --disable-dev-shm-usage \
                             --disable-features=MediaRouter

.PHONY: web-acceptance-chrome-legacy
web-acceptance-chrome-legacy: web-build ## Verifica upload/offline/PWA con Chromium 109 (installa via npx)
	cd $(WEB_DIR) && \
	CHROME109=$$($(CHROMIUM_LEGACY_INSTALL)) && \
	echo "Chromium 109: $$CHROME109" && \
	CHROME_PATH="$$CHROME109" npm run test:acceptance


VNC_DISPLAY := :99
VNC_PORT    := 5900

.PHONY: web-preview-chrome-legacy
web-preview-chrome-legacy: web-build ## Builda, lancia Chromium legacy in VNC su :5900 e serve la preview
	@command -v Xvfb   >/dev/null 2>&1 || { echo "Installa: sudo apt-get install -y xvfb x11vnc"; exit 1; }
	@command -v x11vnc >/dev/null 2>&1 || { echo "Installa: sudo apt-get install -y xvfb x11vnc"; exit 1; }
	trap 'kill $$(jobs -p) 2>/dev/null || true' EXIT; \
	LEGACY=$$(cd $(WEB_DIR) && $(CHROMIUM_LEGACY_INSTALL)); \
	printf '\033[36mBrowser: %s\033[0m\n' "$$("$$LEGACY" --version 2>/dev/null)"; \
	Xvfb $(VNC_DISPLAY) -screen 0 1280x800x24 2>/dev/null & \
	sleep 0.3; \
	cd $(WEB_DIR) && npm run preview -- --port $(WEB_PREVIEW_PORT) & \
	until curl -sf http://127.0.0.1:$(WEB_PREVIEW_PORT) >/dev/null 2>&1; do sleep 0.2; done; \
	DISPLAY=$(VNC_DISPLAY) "$$LEGACY" $(CHROMIUM_LEGACY_FLAGS) \
	  "http://127.0.0.1:$(WEB_PREVIEW_PORT)" 2>/dev/null & \
	x11vnc -display $(VNC_DISPLAY) -forever -nopw -rfbport $(VNC_PORT) -quiet & \
	printf '\033[36mChromium legacy visibile su VNC — porta %s\033[0m\n' $(VNC_PORT); \
	wait

.PHONY: web-preview-dataset-chrome-legacy
web-preview-dataset-chrome-legacy: web-build ## Builda con dataset, lancia Chromium legacy in VNC su :5900 e serve la preview
	@command -v Xvfb   >/dev/null 2>&1 || { echo "Installa: sudo apt-get install -y xvfb x11vnc"; exit 1; }
	@command -v x11vnc >/dev/null 2>&1 || { echo "Installa: sudo apt-get install -y xvfb x11vnc"; exit 1; }
	node scripts/prepare_web_preview_dataset.mjs
	trap 'kill $$(jobs -p) 2>/dev/null || true' EXIT; \
	LEGACY=$$(cd $(WEB_DIR) && $(CHROMIUM_LEGACY_INSTALL)); \
	printf '\033[36mBrowser: %s\033[0m\n' "$$("$$LEGACY" --version 2>/dev/null)"; \
	Xvfb $(VNC_DISPLAY) -screen 0 1280x800x24 2>/dev/null & \
	sleep 0.3; \
	cd $(WEB_DIR) && npm run preview -- --port $(WEB_PREVIEW_PORT) & \
	until curl -sf http://127.0.0.1:$(WEB_PREVIEW_PORT) >/dev/null 2>&1; do sleep 0.2; done; \
	DISPLAY=$(VNC_DISPLAY) "$$LEGACY" $(CHROMIUM_LEGACY_FLAGS) \
	  "http://127.0.0.1:$(WEB_PREVIEW_PORT)" 2>/dev/null & \
	x11vnc -display $(VNC_DISPLAY) -forever -nopw -rfbport $(VNC_PORT) -quiet & \
	printf '\033[36mChromium legacy visibile su VNC — porta %s\033[0m\n' $(VNC_PORT); \
	wait

.PHONY: web-build
web-build: ## Genera la build statica web
	cd $(WEB_DIR) && npm run build

.PHONY: web-audit
web-audit: ## Controlla vulnerabilità nelle dipendenze runtime web
	cd $(WEB_DIR) && npm audit --omit=dev --audit-level=high

.PHONY: web-clean
web-clean: ## Rimuove la build web
	rm -rf $(WEB_DIR)/dist

.PHONY: python-install
python-install: ## Installa le dipendenze del package Python
	cd $(PYTHON_DIR) && UV_LINK_MODE=copy uv sync --dev

.PHONY: python-lint
python-lint: ## Esegue Ruff sul package Python
	cd $(PYTHON_DIR) && uv run ruff check .

.PHONY: python-test
python-test: ## Esegue i test pytest del package Python
	cd $(PYTHON_DIR) && uv run pytest

.PHONY: python-test-integration
python-test-integration: ## Esegue anche i test di integrazione (richiede rete)
	cd $(PYTHON_DIR) && INTEGRATION_TESTS=1 uv run pytest -m integration --override-ini="addopts="

.PHONY: python-build
python-build: ## Genera sdist e wheel del package Python
	cd $(PYTHON_DIR) && uv build

$(DATA_DIR)/OpendataProgetti.zip:
	mkdir -p $(DATA_DIR)
	cd $(PYTHON_DIR) && uv run python -c "from cup_check.opencup_dataset import download_projects_zip; download_projects_zip('../../$(DATA_DIR)/OpendataProgetti.zip')"

.PHONY: dataset-download
dataset-download: $(DATA_DIR)/OpendataProgetti.zip ## Scarica il dump OpenCUP in data/OpendataProgetti.zip

.PHONY: dataset-build
dataset-build: $(DATA_DIR)/OpendataProgetti.zip ## Genera data/cup-index.sqlite dal dump OpenCUP
	cd $(PYTHON_DIR) && uv run python -c "from cup_check.opencup_dataset import build_sqlite_from_projects_zip; build_sqlite_from_projects_zip('../../$(DATA_DIR)/OpendataProgetti.zip', '../../$(DATA_DIR)/cup-index.sqlite')"

.PHONY: dataset-release-local
dataset-release-local: ## Genera dist/dataset per la preview locale con chunk e manifest
	@command -v uv >/dev/null 2>&1 || { echo >&2 "Errore: 'uv' non trovato. Esegui prima: make python-install"; exit 1; }
	SNAPSHOT_DATE="$(DATASET_SNAPSHOT_DATE)"; \
	cd $(PYTHON_DIR) && uv run python ../../scripts/build_dataset.py \
		"$$SNAPSHOT_DATE" \
		"../../dist/dataset" \
		"./datasets/dataset-$${SNAPSHOT_DATE:0:7}"

.PHONY: draft-changelog
draft-changelog: ## Genera un draft della prossima sezione CHANGELOG (uso: make draft-changelog [VERSION=0.5.0])
	@bash scripts/draft-changelog.sh $(VERSION)

.PHONY: clean
clean: web-clean ## Rimuove artefatti generati
	rm -rf .pytest_cache .ruff_cache $(PYTHON_DIR)/.pytest_cache $(PYTHON_DIR)/.ruff_cache $(PYTHON_DIR)/.coverage $(PYTHON_DIR)/dist
