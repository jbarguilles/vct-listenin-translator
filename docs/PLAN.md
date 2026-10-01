# Plan

Weekends from 2026-10-03 to 2026-11-22. Target: a public v0.1 before VCT Kickoff (~January 2027), the first live Listen-ins of the season. Until then, all testing runs on Twitch VODs.

Vocabulary follows [CONTEXT.md](../CONTEXT.md). Decisions are in [docs/adr](./adr).

## Scope

- **MVP:** Viewer Arms the translator on a Twitch Broadcast; Comms not in the Viewer language become Subtitles in the player, with L1 Speaker colors and an optional Transcript line.
- **v2:** Naming. The Viewer assigns Players from a static per-season Roster to Speakers.
- **Parked:** automatic Player recognition (ADR-0003), automatic Listen-in detection, Firefox, YouTube, OBS plugin for Co-streamers, desktop app.

## Stack

- Chromium (Chrome/Edge) only, Manifest V3, WXT + TypeScript
- `chrome.tabCapture` + offscreen document, with audio passthrough so the tab is not muted
- Gladia real-time for transcription, Claude Haiku (`claude-haiku-4-5-20251001`) for translation, both with the Viewer's own keys (ADR-0001, ADR-0002)
- One pipeline module (`Transcriber → Translator → Subtitle`) shared by the extension and the eval CLI (Node)
- MIT license

## Milestones

| Weekend | Milestone | Done when |
|---|---|---|
| W1 · Oct 3–4 | Scaffold WXT repo; tab capture, offscreen doc, audio passthrough; Armed chip; popup for the two keys | Arming a Twitch tab works and audio keeps playing |
| W2 · Oct 10–11 | Gladia real-time streaming; Transcript + language detection; skip Viewer-language speech | Korean Transcript lines appear during a VOD, casters skipped |
| W3 · Oct 17–18 | Haiku translation; Lexicon v0 (`core`, `callouts`, `ko`); Subtitle overlay (3 lines, fade, Speaker colors, optional Transcript line) | **Working MVP on a VOD** |
| W4 · Oct 24–25 | Eval CLI + 10–15 Reference clips (metadata committed, audio gitignored via yt-dlp) | One command prints delay, Lexicon hit rate, Speaker split accuracy |
| W5 · Oct 31–Nov 1 | Tuning: Lexicon growth, prompt, context window, delay | Metrics improve over the W4 baseline |
| W6 · Nov 7–8 | Comms log, settings (Viewer language, Transcript toggle), fullscreen/theater, error states (bad key, quota, dropped socket) | Usable by someone other than the author |
| W7 · Nov 14–15 | v2 Naming with a 2026 Roster file; click a Speaker label to name it | Names hold for a whole session |
| W8 · Nov 21–22 | README with BYOK setup, demo GIF, GitHub release v0.1 | Public release |

**Cut order if behind:** W7 slips to December first, then the Comms log.

## Evaluation

- Reference clips are `{vod_url, start, end, reference_subtitles, provenance}`. Never commit Broadcast audio; it belongs to Riot.
- Provenance is `fan-verified` (checked against fan-made subtitles) or `model-drafted` (drafted by a stronger model than the one under test). Prefer clips with existing fan subs; report metrics per provenance.
- Targets: delay ≤ 4 s from speech start to Subtitle.

## Lexicon

- Used twice: as Gladia custom vocabulary, and in the Haiku translation prompt.
- Canonical terms stay in English in every Viewer language.
- Layout: `lexicon/core.json`, `lexicon/callouts/<map>.json`, `lexicon/<lang>.json` (Spoken form → Canonical term). Start with Korean; other languages via community PRs.

## Known gotchas

- Tab capture mutes the tab unless the extension plays the stream back itself.
- Calling Claude from the browser requires the `anthropic-dangerous-direct-browser-access` header (acceptable because keys are the Viewer's own).
- Gladia Speaker IDs reset per streaming session, so Speakers are not stable across Listen-ins.
- Armed means caster audio is transcribed (and billed) too; the chip must make cost visible.
