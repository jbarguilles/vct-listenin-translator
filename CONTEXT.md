# VCT Listen-in Translator

Live translated subtitles for team voice comms played during VCT broadcasts, so viewers can follow comms spoken in languages they don't understand.

## Language

### Broadcast

**Broadcast**:
A live VCT stream as a viewer watches it, either the official channel or a co-stream.
_Avoid_: Stream (ambiguous), video

**Co-stream**:
A third-party creator's rebroadcast of the official Broadcast with their own commentary layered on top.
_Avoid_: Watch party, restream

**Broadcast mix**:
The single combined audio track a viewer hears: casters, game audio, comms, and (on a Co-stream) the co-streamer.
_Avoid_: Stream audio, tab audio

**Listen-in**:
A segment of the Broadcast where one team's voice comms are played to viewers, usually 10–60 seconds long.
_Avoid_: Comms segment, voice clip

**Comms**:
The players' speech within a Listen-in, as distinct from casters or game audio in the Broadcast mix.
_Avoid_: Voice chat, team audio

### Language processing

**Transcript**:
The Comms written out in the language they were spoken in, before translation.
_Avoid_: Caption, raw text, source text

**Lexicon**:
The curated Valorant vocabulary (agents, abilities, map callouts, slang, and their loanword pronunciations per language) used to translate Comms faithfully.
_Avoid_: Glossary (reserved for this document), dictionary, terms list

**Canonical term**:
The English name of a Valorant concept (agent, ability, map callout, weapon, common call) that Subtitles keep untranslated in every Viewer language.
_Avoid_: Keyword, game term, jargon

**Spoken form**:
A way players actually say a Canonical term in a given language, including loanwords and abbreviations (e.g. 로테 for "rotate").
_Avoid_: Slang, alias, variant

### Evaluation

**Reference clip**:
A Listen-in identified by its VOD and time range, paired with a Reference translation. The clip's audio is never part of the project.
_Avoid_: Test clip, sample, fixture

**Reference translation**:
The accepted Subtitles for a Reference clip, with its provenance: fan-verified (checked against fan-made subtitles) or model-drafted (written by a stronger model, unverified).
_Avoid_: Ground truth, gold standard, expected output

### Attribution

**Speaker**:
An unnamed voice distinguished within a single Listen-in. A Speaker is not guaranteed to be the same person across Listen-ins.
_Avoid_: Voice, talker, Player (when unnamed)

**Player**:
A named professional on a team's Roster, e.g. DRX BuZz.
_Avoid_: Speaker (when named), pro, user

**Roster**:
The five Players (plus substitutes) a team fields in a given VCT season.
_Avoid_: Lineup, team list

**Naming**:
The Viewer's act of assigning a Player from the Roster to a Speaker for the rest of the session.
_Avoid_: Tagging, labeling, identification

### Output

**Subtitle**:
A line of translated Comms text shown over the Broadcast, timed to the speech it translates. It may carry its Transcript line beneath it.
_Avoid_: Caption (reserved for same-language transcription), overlay text

**Comms log**:
The scrollable history of every Subtitle shown during the current session.
_Avoid_: Transcript (that is the untranslated text), history, chat log

**Viewer**:
The person running the translator while watching a Broadcast. The Viewer is not the broadcaster.
_Avoid_: User, audience

**Viewer language**:
The language the Viewer reads Subtitles in. Speech already in the Viewer language is never subtitled.
_Avoid_: Target language, locale

**Armed**:
The state in which the Viewer has switched the translator on for the current Broadcast. Only while Armed does any Broadcast mix leave the Viewer's machine.
_Avoid_: Active, listening, enabled
