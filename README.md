# VCT Listen-in Translator

A Chromium extension that shows live translated subtitles for team comms during VCT Listen-ins, e.g. a Korean team's comms subtitled in English, with each Speaker in a different color.

Status: planning. See [docs/PLAN.md](docs/PLAN.md), the domain glossary in [CONTEXT.md](CONTEXT.md), and decisions in [docs/adr](docs/adr).

Bring your own keys: [Gladia](https://www.gladia.io) for transcription and [Anthropic](https://console.anthropic.com) for translation.

## Development

Requires Node 20+ and Chrome/Edge 116+.

    npm install
    npm run dev      # launches Chrome with the extension loaded
    npm test         # unit tests
    npm run build    # production build in .output/chrome-mv3
