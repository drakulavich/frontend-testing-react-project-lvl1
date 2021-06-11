install: install-deps

run:
	bin/page-loader.js 10

install-deps:
	npm ci

test:
	npm test

test-coverage:
	npm test -- --coverage --coverageProvider=v8

lint:
	eslint .

publish:
	npm publish

.PHONY: test