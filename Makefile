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
	cd $(PYTHON_DIR) && uv run pre-commit install
	cd $(PYTHON_DIR) && uv run pre-commit install --hook-type pre-push

.PHONY: check
check: web-lint web-check web-test-types web-coverage web-build web-audit python-lint python-test ## Esegue tutte le verifiche locali veloci

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

.PHONY: web-check
web-check: ## Esegue svelte-check (type-check file .svelte e .ts)
	cd $(WEB_DIR) && npm run check

.PHONY: web-test-types
web-test-types: ## Esegue il type-check TypeScript sui test web
	cd $(WEB_DIR) && npm run check:tests

.PHONY: web-test
web-test: ## Esegue i test Vitest una volta
	cd $(WEB_DIR) && npm test -- --run

.PHONY: web-coverage
web-coverage: ## Esegue i test Vitest con coverage e verifica le soglie (lines ≥ 95%, branches ≥ 90%)
	cd $(WEB_DIR) && npm run test:coverage

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
                             --disable-features=MediaRouter \
                             --test-type --disable-infobars \
                             --window-size=1920,1080 --window-position=0,0

.PHONY: web-acceptance-chrome-legacy
web-acceptance-chrome-legacy: web-build ## Verifica upload/offline/PWA con Chromium 109 (installa via npx)
	@if [ "$$(uname -m)" = "aarch64" ]; then \
		echo "SKIP: Chromium 109 (rev $(CHROMIUM_LEGACY_REVISION)) esiste solo come build x86_64;"; \
		echo "      esegui questo target su un host x86_64 (es. CI) per la verifica legacy completa."; \
	else \
		cd $(WEB_DIR) && \
		CHROME109=$$($(CHROMIUM_LEGACY_INSTALL)) && \
		echo "Chromium 109: $$CHROME109" && \
		CHROME_PATH="$$CHROME109" npm run test:acceptance; \
	fi


VNC_DISPLAY      := :99
VNC_PORT         := 5900
NOVNC_PORT       := 9000
NOVNC_PATH       := /vnc.html?resize=scale
VNC_PREVIEW_PORT := 4174
VNC_RESOLUTION   := 1920x1080x24

define _vnc_chrome_legacy_run
@command -v Xvfb       >/dev/null 2>&1 || { echo "Installa: sudo apt-get install -y xvfb x11vnc"; exit 1; }
@command -v x11vnc     >/dev/null 2>&1 || { echo "Installa: sudo apt-get install -y xvfb x11vnc"; exit 1; }
@command -v websockify >/dev/null 2>&1 || { echo "Installa: sudo apt-get install -y novnc"; exit 1; }
@command -v openbox    >/dev/null 2>&1 || { echo "Installa: sudo apt-get install -y openbox"; exit 1; }
trap 'kill $$(jobs -p) 2>/dev/null || true' EXIT; \
LEGACY=$$(cd $(WEB_DIR) && $(CHROMIUM_LEGACY_INSTALL)); \
printf '\033[36mBrowser: %s\033[0m\n' "$$("$$LEGACY" --version 2>/dev/null)"; \
Xvfb $(VNC_DISPLAY) -screen 0 $(VNC_RESOLUTION) 2>/dev/null & \
sleep 0.3; \
DISPLAY=$(VNC_DISPLAY) openbox --config-file /dev/null 2>/dev/null & \
cd $(WEB_DIR) && npm run preview -- --port $(VNC_PREVIEW_PORT) & \
until curl -sf http://127.0.0.1:$(VNC_PREVIEW_PORT) >/dev/null 2>&1; do sleep 0.2; done; \
DISPLAY=$(VNC_DISPLAY) "$$LEGACY" $(CHROMIUM_LEGACY_FLAGS) \
  "http://127.0.0.1:$(VNC_PREVIEW_PORT)" 2>/dev/null & \
env -u WAYLAND_DISPLAY DISPLAY=$(VNC_DISPLAY) x11vnc -display $(VNC_DISPLAY) -forever -nopw -rfbport $(VNC_PORT) -quiet & \
until (exec 3<>/dev/tcp/127.0.0.1/$(VNC_PORT)) 2>/dev/null; do sleep 0.1; done; \
websockify --web /usr/share/novnc/ $(NOVNC_PORT) 127.0.0.1:$(VNC_PORT) >/dev/null 2>&1 & \
printf '\033[36mApri nel browser: http://localhost:%s%s\033[0m\n' $(NOVNC_PORT) '$(NOVNC_PATH)'; \
wait
endef

.PHONY: web-preview-chrome-legacy
web-preview-chrome-legacy: web-build ## Builda, lancia Chromium legacy — noVNC browser su :9000, VNC raw su :5900
	$(call _vnc_chrome_legacy_run)

.PHONY: web-preview-dataset-chrome-legacy
web-preview-dataset-chrome-legacy: web-build ## Builda con dataset, lancia Chromium legacy — noVNC browser su :9000, VNC raw su :5900
	node scripts/prepare_web_preview_dataset.mjs
	$(call _vnc_chrome_legacy_run)

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

.PHONY: refresh-python-matrix
refresh-python-matrix: ## Aggiorna scripts/python-versions-manifest.json dal manifest remoto
	python3 -c "\
import json, urllib.request; \
url='https://raw.githubusercontent.com/actions/python-versions/main/versions-manifest.json'; \
data=json.loads(urllib.request.urlopen(url,timeout=30).read()); \
open('scripts/python-versions-manifest.json','w').write(json.dumps(data,indent=2)+'\n')"
	@echo "Manifest aggiornato. Commit con: git add scripts/python-versions-manifest.json"

.PHONY: python-build
python-build: ## Genera sdist e wheel del package Python
	cd $(PYTHON_DIR) && uv build

$(DATA_DIR)/OpendataProgetti.zip:
	mkdir -p $(DATA_DIR)
	cd $(PYTHON_DIR) && uv run python -c "from cup_check.opencup_dataset import download_projects_zip; download_projects_zip('../../$(DATA_DIR)/OpendataProgetti.zip', skip_if_exists=True)"

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
		--skip-if-exists \
		"$$SNAPSHOT_DATE" \
		"../../dist/dataset" \
		"./datasets/dataset-$${SNAPSHOT_DATE:0:7}" \
		"../../$(DATA_DIR)/OpendataProgetti.zip"

.PHONY: draft-changelog
draft-changelog: ## Genera un draft della prossima sezione CHANGELOG (uso: make draft-changelog [VERSION=0.5.0])
	@bash scripts/draft-changelog.sh $(VERSION)

.PHONY: clean
clean: web-clean ## Rimuove artefatti generati
	rm -rf .pytest_cache .ruff_cache $(PYTHON_DIR)/.pytest_cache $(PYTHON_DIR)/.ruff_cache $(PYTHON_DIR)/.coverage $(PYTHON_DIR)/dist
