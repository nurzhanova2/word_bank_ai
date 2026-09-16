# Diagnostics

`GET /health` is a small backward-compatible liveness response. Authenticated `GET /api/v1/diagnostics` returns version, runtime/HTTPS state, provider name, and explicitly supplied safe readiness fields only. It never returns credentials, session tokens, environment values, filesystem paths, document text, provider responses, or stack traces.

The tray’s existing **Исправить HTTPS-сертификат** action re-runs the supported Office certificate trust repair and restarts the local runtime. After repair, fully close and reopen Word.
