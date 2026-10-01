# Gladia for transcription, Claude Haiku for translation

Comms are transcribed by Gladia's real-time API and translated by Claude Haiku using the Lexicon, so a Viewer supplies two keys. We chose Gladia over a single-key OpenAI setup because it includes speaker separation at no extra charge (needed for speaker attribution) and covers 100+ languages with code-switching, which matters because pro comms mix the native language with English loanwords. Its one-time free credit also offsets the BYOK onboarding friction from ADR-0001. Translation stays on a separate LLM rather than Gladia's built-in translation so the Lexicon and recent-line context can shape every Subtitle.

## Considered Options

- **OpenAI only (one key)** — cheaper (~$0.36/hr vs $0.75/hr) and simpler onboarding, but weak speaker separation would force a second transcription provider for speaker attribution anyway.
- **Deepgram** — lowest latency, but streaming covers too few languages for "any language".
- **Gladia's built-in translation** — one key, but no way to apply the Lexicon.

## Consequences

- Claude is called directly from the browser, which requires Anthropic's direct-browser-access opt-in header; acceptable only because the key is the Viewer's own (ADR-0001).
- Transcription and translation sit behind separate interfaces so either provider can be swapped.
