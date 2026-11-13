# IMPERION zero-cost cloud runtime - portable deployment proof

Stateless test program for verifying genuine CPU execution on general-purpose cloud Web Services/VMs. It is **not** a production application, CRM or autonomous agent. No secret, external API, payment processor, database, or persistent storage.

* GET /health: status LIVE.
* POST /compute JSON {"op":"primes","n":1000} returns prime_count 168.
* POST /compute JSON {"op":"sha256","text":"abc"} returns SHA-256.
* Inputs bounded: 2 KiB request, n <= 5000; no network egress.
* Unit proof: node --test ops/free-cloud/server.test.mjs
* Run: cd ops/free-cloud && PORT=8080 node server.mjs
* Docker: cd ops/free-cloud && docker build -t imperion-cloud-smoke . && docker run --rm -p 8080:8080 imperion-cloud-smoke

Deploy targets, **only after account access and Free tier readback**: Render Free Docker Web Service with Root Directory ops/free-cloud and Free plan; Koyeb Free Web Service with same Dockerfile; Oracle Always Free VM from existing personal account. DO NOT enable paid plans, no credit cards, no auto-billing or paid fallback. Render and Koyeb free web services go idle, not for guaranteed production uptime. Keep NGO, OSVC and academic cloud resources separate.

Status: staged source only. A GitHub PR is not a live deployment. Close the deployment gate only when provider URL /health is LIVE and /compute returns prime_count 168, plus plan/usage readback.
