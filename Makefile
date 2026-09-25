PRIMARY_GOAL := $(firstword $(MAKECMDGOALS))
ARGS := $(wordlist 2,999,$(MAKECMDGOALS))
ARG1 := $(word 1,$(ARGS))
ARG2 := $(word 2,$(ARGS))
ARG3_PLUS := $(wordlist 3,999,$(ARGS))
ARG2_PLUS := $(wordlist 2,999,$(ARGS))

.PHONY: help gtd client sync-server client-package client-install dev staging client-dev client-staging test unit integration e2e check lint

help:
	@if [ "$(PRIMARY_GOAL)" = "help" ] || [ -z "$(PRIMARY_GOAL)" ]; then \
	  printf '%s\n' \
	    'GTD on Rails development commands' \
	    '' \
	    'Run processes in separate terminals:' \
	    '  make gtd                    desktop + local API using dev data' \
	    '  make gtd staging            desktop + local API using staging data' \
	    '  make client                 sync client using dev data' \
	    '  make client staging         sync client using staging data' \
	    '  make client-package         build standalone client tarball' \
	    '  make client-install         install latest published production client' \
	    '' \
	    'Test selection:' \
	    '  make test' \
	    '  make test unit' \
	    '  make test integration api' \
	    '  make test e2e desktop' \
	    '  make test unit desktop itemBodyPersistence' \
	    '  make test unit api DatabaseSyncServiceTests' \
	    '  make test unit client SnapshotBackupServiceTests' \
	    '' \
	    'Short test commands:' \
	    '  make unit [scope] [test]' \
	    '  make integration [scope] [test]' \
	    '  make e2e [scope] [test]' \
	    '  make check [scope]' \
	    '  make lint [scope]' \
	    '' \
	    'Environments: dev | staging (dev is the default)' \
	    'Scopes:       all | desktop | api | client | sync-server | scripts'; \
	fi

gtd:
	@if [ "$(PRIMARY_GOAL)" = "gtd" ]; then \
	  node scripts/run-gtd.mjs --env=$(if $(ARG1),$(ARG1),dev); \
	fi

client:
	@if [ "$(PRIMARY_GOAL)" = "client" ]; then \
	  node scripts/run-client.mjs --env=$(if $(ARG1),$(ARG1),dev); \
	fi

sync-server:
	@if [ "$(PRIMARY_GOAL)" = "sync-server" ]; then \
	  node scripts/run-client.mjs --env=$(if $(ARG1),$(ARG1),dev); \
	fi

client-package:
	@if [ "$(PRIMARY_GOAL)" = "client-package" ]; then \
	  cd apps/sync-server && ./gradlew --no-daemon bootJar; \
	  cd ../.. && bash apps/sync-server/scripts/package-client-linux.sh; \
	fi

client-install:
	@if [ "$(PRIMARY_GOAL)" = "client-install" ]; then \
	  node scripts/install-client-release.mjs; \
	fi

dev:
	@if [ "$(PRIMARY_GOAL)" = "dev" ]; then \
	  node scripts/run-gtd.mjs --env=dev; \
	fi

staging:
	@if [ "$(PRIMARY_GOAL)" = "staging" ]; then \
	  node scripts/run-gtd.mjs --env=staging; \
	fi

client-dev:
	@if [ "$(PRIMARY_GOAL)" = "client-dev" ]; then \
	  node scripts/run-client.mjs --env=dev; \
	fi

client-staging:
	@if [ "$(PRIMARY_GOAL)" = "client-staging" ]; then \
	  node scripts/run-client.mjs --env=staging; \
	fi

test:
	@if [ "$(PRIMARY_GOAL)" = "test" ]; then \
	  node scripts/test.mjs \
	    --type=$(if $(ARG1),$(ARG1),all) \
	    --scope=$(if $(ARG2),$(ARG2),all) \
	    --test="$(ARG3_PLUS)"; \
	fi

unit:
	@if [ "$(PRIMARY_GOAL)" = "unit" ]; then \
	  node scripts/test.mjs \
	    --type=unit \
	    --scope=$(if $(ARG1),$(ARG1),all) \
	    --test="$(ARG2_PLUS)"; \
	fi

integration:
	@if [ "$(PRIMARY_GOAL)" = "integration" ]; then \
	  node scripts/test.mjs \
	    --type=integration \
	    --scope=$(if $(ARG1),$(ARG1),all) \
	    --test="$(ARG2_PLUS)"; \
	fi

e2e:
	@if [ "$(PRIMARY_GOAL)" = "e2e" ]; then \
	  node scripts/test.mjs \
	    --type=e2e \
	    --scope=$(if $(ARG1),$(ARG1),all) \
	    --test="$(ARG2_PLUS)"; \
	fi

check:
	@if [ "$(PRIMARY_GOAL)" = "check" ]; then \
	  node scripts/test.mjs --type=check --scope=$(if $(ARG1),$(ARG1),all) --test=""; \
	fi

lint:
	@if [ "$(PRIMARY_GOAL)" = "lint" ]; then \
	  node scripts/test.mjs --type=lint --scope=$(if $(ARG1),$(ARG1),all) --test=""; \
	fi

.DEFAULT:
	@if [ "$@" = "$(PRIMARY_GOAL)" ]; then \
	  printf 'Unknown make command: %s\nRun make help for usage.\n' "$@" >&2; \
	  exit 2; \
	fi
