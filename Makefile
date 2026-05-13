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
release-check: check web-acceptance web-lighthouse ## Esegue anche le prove browser/Lighthouse per il rilascio

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
	cd $(WEB_DIR) && npm run test:acceptance

.PHONY: web-lighthouse
web-lighthouse: web-build ## Verifica soglie Lighthouse MVP sulla build statica
	cd $(WEB_DIR) && npm run test:lighthouse

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
	cd $(PYTHON_DIR) && uv sync --dev

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
	SNAPSHOT_DATE="$(DATASET_SNAPSHOT_DATE)"; \
	cd $(PYTHON_DIR) && uv run python ../../scripts/build_dataset.py \
		"$$SNAPSHOT_DATE" \
		"../../dist/dataset" \
		"./datasets/dataset-$${SNAPSHOT_DATE:0:7}"

.PHONY: clean
clean: web-clean ## Rimuove artefatti generati
	rm -rf .pytest_cache .ruff_cache $(PYTHON_DIR)/.pytest_cache $(PYTHON_DIR)/.ruff_cache $(PYTHON_DIR)/.coverage $(PYTHON_DIR)/dist
