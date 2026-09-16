# Security model

The API key is stored as a Windows DPAPI-protected blob through Electron `safeStorage`; the user-readable `.env` contains connection settings only. A legacy plaintext `LLM_API_KEY` is migrated once after successful protection and then removed. The settings IPC returns only `hasApiKey`, never the value.

Each desktop runtime creates a new 32-byte session token. The add-in obtains it from the same-origin no-store bootstrap endpoint and sends it in `X-Bank-AI-Session`; it is not persisted, logged, placed in a URL, diagnostics, or provider calls. API routes also reject untrusted Origin and Host headers.

This is process-level localhost protection, not a substitute for workstation access controls: an untrusted process running as the same user remains in that user’s security boundary.
