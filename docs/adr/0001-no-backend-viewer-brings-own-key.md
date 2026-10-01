# No backend: the Viewer brings their own API key

The extension calls speech-to-text and translation providers directly from the Viewer's browser using an API key the Viewer supplies; there is no server we operate. This keeps a side project at zero running cost and avoids accounts, billing, and abuse protection. The price is onboarding friction (a Viewer must obtain a key) and the key living in extension storage on the Viewer's machine. Revisit if the project needs to reach non-technical Viewers, which would require a hosted relay plus auth and billing.

## Considered Options

- **Hosted backend we pay for** — easiest for Viewers, but unbounded cost and needs auth/rate limiting.
- **Fully local in-browser model (Whisper on WebGPU)** — free and private, but too heavy and slow for live Comms on typical Viewer hardware; worth revisiting as hardware and models improve.
