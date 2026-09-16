# Installer acceptance checklist

These require a Windows installer session and are **NOT RUN** here: clean install, reinstall, upgrade, uninstall registry cleanup, Word manifest registration, trusted HTTPS startup, bundled LanguageTool/JRE startup, unsigned-artifact warning, and signed-artifact verification when a signing certificate is supplied.

The current pilot artifact is **UNSIGNED** unless CI supplies standard code-signing credentials. Do not report it as signed without verifying the generated executable.
