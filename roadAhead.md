# Veien videre — Grapple Gliders

Strategiske alternativer for hva som bør bygges videre, rangert etter realistisk effekt kontra kostnad. Skrevet som en ærlig vurdering, ikke som en ønskeliste. Utgangspunktet er: spillet er teknisk klart. Spørsmålet er om mer investering faktisk gir reell oppside, eller bare polering ingen legger merke til.

---

## Hvor spillet faktisk står nå

| Dimensjon                                       | Status                                                                                                               |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Lanseringsklart teknisk                         | Ja. SDK, annonser, cloud save, mobil og bundle-størrelse er alle grønne.                                             |
| Lanseringsklart kommersielt                     | Middels. Mettet kategori, ingen innebygd sosial loop, og følelsen av swing-physics er usynlig i thumbnail-størrelse. |
| Realistisk tak slik det er nå                   | 5 000–200 000 spillinger totalt. Long-tail-inntekter i lave tresifrede beløp.                                        |
| Realistisk gulv slik det er nå                  | Blir akseptert i katalogen, samler støv, cirka 10–50 dollar i livstidsinntekter.                                     |
| Sannsynlighet for gjennombrudd (>1M spillinger) | Cirka 1–3 %. Ikke null. Stickman Hook, Flappy Bird og Crossy Road kom alle fra denne typen enkle former.             |
| Kostnad for å lansere slik det er nå            | I praksis null. Innsending er gratis, builden er ferdig.                                                             |
| Kostnad for å lansere og gå videre              | Null.                                                                                                                |
| Kostnad for å fortsette å iterere               | Åpen/ubegrenset.                                                                                                     |

**Det strategiske spørsmålet er ikke «bør jeg lansere dette?». Det er: «Når jeg har lansert dette, bør jeg fortsette å bygge videre på det eller gå videre?»** Det er to separate avgjørelser, og den andre bør besvares med *data etter lansering*, ikke håp før lansering.

---

## Status — polish-runden (pre-launch, mai 2026)

Følgende ble levert i polish-runden før lansering. Bevisst utelukkelse: backend og multiplayer bygges ikke på dette stadiet.

**Tier S — ferdig:**

- **Replay-eksport til WebM** via `MediaRecorder` med rullende 30 s-cap. Web Share API på mobil, anker-nedlasting ellers. Stille no-op på nettlesere uten støtte. Se `src/systems/RunRecorder.ts`.
- **Reelle lydeffekter:** distinkt perfect-anchor-chime, lagdelt death-sekvens med sub-rumble og noise-crash, level-up-fanfare, ambient lava roar med proximity-modulert gain, boss-klaxon, trick-stab. Alle prosedyrale — ingen nye lydfiler. Se `src/audio/SFX.ts`.
- **Kosmetisk preview etter run:** «this run earned X toward Y» med fremdriftsbar som markerer dette run-ets bidrag i gull over baseline-cyan. Se `src/systems/UnlockSystem.ts` + `src/ui/GameOverScreen.ts`.
- **Share-card-polering:** NEW PB-stjerne, trick-chip-rad, gradient-CTA, mode-aware bragging-tekst. Se `src/ui/ShareCard.ts` + `src/ui/ShareScreen.ts`.

**Tier A — ferdig (delvis):**

- **Trick-system:** fysikk-drevet deteksjon av Drop, Whip, Pendulum, Wall Run, Threading, Slingshot og Skim. Mid-run callout-banner, kombo-multiplisert score-bonus, end-of-run chip-oppsummering, integrasjon i share-card og share-tekst. Hver trick har egen scoreverdi og farge. Se `src/systems/TrickSystem.ts` + `src/ui/TrickCallout.ts`.
- **2 nye temaer:** Lunar Drift (2200 Sparks) og Molten Core (2400 Sparks). Foreløpig kun visuelle — ingen mekaniske vridninger som lav gravitasjon eller reversert tyngdekraft. Se `src/content/themes.ts`.

**Tier B — ferdig (delvis):**

- **Boss waves i Endless:** hver 1000 m utløses en bølge der dødelig grus regner ned ovenfra, med klaxon, advarselsbanner og kortvarig lavabremse som belønning for overlevelse. Skjold absorberer ett treff. Se `triggerBossWave` / `updateBossDebris` i `src/game/Game.ts`.

**Bundle:** 218 KB / 61 KB gzipped (+21 KB / +6 KB vs. baseline). Tester: 75/75 grønne (12 nye dekker trick-deteksjon og unlock-preview).

**Det som bevisst gjenstår:** leaderboard-backend-deploy, async ghost MP, weekly tournament (alle krever backend); course editor (utsatt som valgfritt); ett biom med faktisk *mekanisk* vridning (de to nye er kun visuelle); story/campaign; sanntids-multiplayer; spectator/replay-studio. Resten av dokumentet under er fortsatt gyldig for prioritering av neste runde *etter* lanseringsdata.

---

## Tre ærlige veier

### Vei 1 — Lanser og gå videre

Behandle spillet som ferdig. Send det inn til CrazyGames. Få data. Gå videre til neste konsept med alt du har lært her.

* **Kostnad:** Cirka 1 dag, inkludert innsending, skjermbilder og praktisk arbeid.
* **Oppside:** Moderate spillertall, porteføljestykke, ekte analyse.
* **Risiko:** Hvis spillet faktisk treffer en nerve, er du ikke der for å utnytte momentumet.
* **Når dette er riktig:** Hvis spillet ikke engasjerer deg lenger, eller hvis du har et sterkere konsept klart.

### Vei 2 — Lanser, og legg deretter til én stor feature basert på data

Send inn spillet. Følg CrazyGames-analytikken i 2–4 uker. Hvis retention eller DAU viser liv, invester i *én* større feature som treffer svakheten dataene avslører. Hvis tallene er flate, går du ryddig videre.

* **Kostnad:** 1 dag nå, deretter 1–4 uker senere hvis tallene rettferdiggjør det.
* **Oppside:** Investeringen er *fortjent* gjennom data, ikke basert på håp. Riktig feature kan løfte taket 5–10x.
* **Risiko:** Lavest av de tre veiene.
* **Når dette er riktig:** Dette er den anbefalte veien for nesten alle indie-HTML5-spill.

### Vei 3 — Bygg multiplayer / stor feature på forhånd

Ikke lanser før spillet har den sosiale hooken du tror det trenger. Sats på at en større v1 treffer hardere enn en mindre v1.

* **Kostnad:** 4–12 uker, avhengig av feature.
* **Oppside:** Hvis den store featuren er riktig, lanseres spillet med en ekte hook og kan klatre.
* **Risiko:** Høyest. Du satser på en hypotese du ikke kan teste før du allerede har betalt for den. De fleste forhåndsbygde features ender opp med å være *ikke* det dataene ville fortalt deg at du burde bygge.
* **Når dette er riktig:** Når du har sterk, konkret overbevisning om hva som mangler — ikke «jeg bør legge til multiplayer», men «jeg vet nøyaktig hvilken multiplayer-modus, og jeg har skissert UX-en».

**Min anbefaling: Vei 2.** Lanser nåværende versjon, gi CrazyGames 3–4 uker, og bestem deg deretter basert på faktiske tall. Ikke forplikt deg til multiplayer eller noen annen stor satsing uten data bak.

---

## Feature-ideer rangert etter ROI

Estimater antar den eksisterende kodebasen. Dager betyr kalenderdager for en erfaren soloutvikler som allerede kjenner kodebasen.

### Tier S — Høy effekt, lav kostnad

Gjør disse *før* lansering hvis du har en dag til overs.

| Feature                                                                                                         | Kostnad   | Effekt      | Status                  | Hvorfor                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------- | --------- | ----------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Deploy leaderboard-backenden. Cloudflare Worker-template finnes allerede.                                       | 2–4 timer | Høy         | **Gjenstår** (backend)  | Daily blir en *ekte* konkurranse i stedet for solo + bots. Infrastrukturen er allerede designet i `server/cloudflare-worker.ts`. Free tier er mer enn nok for lanseringstrafikk.           |
| Replay-eksport til WebM / animert PNG                                                                           | 1–2 dager | Høy         | **Levert**              | Den klart mest manglende virale hooken. Et swing-physics-spill *bør* ha delbare klipp, ikke bare skjermbilder. Implementert via `MediaRecorder` på `canvas.captureStream()` — se `src/systems/RunRecorder.ts`. |
| Legg til 3–4 ekte lydeffekter, for eksempel death, perfect anchor og lava roar, i tillegg til whip + soundtrack | 1 dag     | Middels-høy | **Levert**              | Lyd er den billigste kvalitetshevingen spillerne merker. Levert som prosedyrale, men lagdelt og distinkt: perfect-anchor-chime, death med sub-rumble + noise-crash, level-up-fanfare, ambient lava roar, boss-klaxon, trick-stab. Se `src/audio/SFX.ts`. |
| Kosmetisk preview etter run, for eksempel «this run earned 47 Sparks toward Blade Hook»                         | 4 timer   | Middels     | **Levert**              | Driver unlock-bruk og retention. Levert som fremdriftsbar med dette run-ets bidrag fremhevet i gull over baseline-cyan. Se `nextCheapestUnlock()` i `src/systems/UnlockSystem.ts` og rendering i `src/ui/GameOverScreen.ts`. |

### Tier A — Reell oppside, moderat kostnad

1–3 uker hver.

| Feature                                                                                                                                                                                                                | Kostnad       | Effekt      | Hvorfor                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Trick system** — navngitte bevegelser som Drop, Pendulum, Slingshot og Wall-Ride, oppdaget fra fysikktilstand, med multiplikator-score og visning midt i run-et med delbare replay-tags                              | 2–3 uker      | Høy         | Løser problemet med at «alle skjermbilder ser like ut». Hvert run blir en *historie* med navngitte øyeblikk. Levert med 7 tricks: Drop, Whip, Pendulum, Wall Run, Threading, Slingshot, Skim — med mid-run-callout, score-bonus, end-of-run-oppsummering og share-card-integrasjon. Se `src/systems/TrickSystem.ts`. **STATUS: Levert.** |
| **Async ghost multiplayer** — serverbasert ghost-matchmaking: dagens daily seed parer deg med et opptak fra noen innenfor ±10 % av ferdighetsnivået ditt. Du konkurrerer live mot replayet deres, ved siden av lavaen. | 1–2 uker      | Høy         | Løser social-pull-problemet uten sanntidsserverkostnad. Bare KV-lagring av ghost-replays + en «finn lignende score»-spørring. Utnytter eksisterende `personalBestGhost`-encoding. **STATUS: Gjenstår (backend ekskludert).**                                                                              |
| **Course Editor + Share Code** — la spillere håndlage Time Attack-baner og dele dem via 8-tegns koder. Workshop er valgfritt; koder er nok.                                                                            | 2–3 uker      | Høy         | Brukergenerert innhold er den sterkeste retention-multiplikatoren på plattformer som CrazyGames. Banedataformatet er allerede enkelt, se `src/content/timeAttackCourses.ts`. **STATUS: Utsatt (valgfritt).**                                                                                   |
| Weekly tournament mode — samme seed hele uken, premier via Sparks / kosmetikk                                                                                                                                          | 1 uke         | Middels-høy | Et lag med høyere innsats over daily. Verdt å gjøre når daily-leaderboard-backenden er live. **STATUS: Gjenstår (backend ekskludert).**                                                                                                                                                                   |
| 2–3 flere temaverdener med mekaniske vridninger, for eksempel lavgravitasjons-månebiom, reversert gravitasjon i invertert tårn, eller tåke-/siktbiom                                                                   | 1–2 uker hver | Middels     | Hvert biom er én ny *ting spillerne kan snakke om*. Langt mer virkningsfullt enn enda et skin. **STATUS: Delvis levert.** 2 nye visuelle temaer (Lunar Drift, Molten Core) lagt til i `src/content/themes.ts`. *Mekaniske* vridninger (lavgrav, reversert gravitasjon) gjenstår — tema-systemet er kun visuelt i dag.                                                                                                                                                                 |

### Tier B — Stor forpliktelse, betinget oppside

1–3 måneder hver.

| Feature                                                                                                                                                                                           | Kostnad     | Effekt                                                       | Hvorfor                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sanntids-multiplayer-race**. Se egen seksjon under.                                                                                                                                             | 2–3 måneder | Svært høy *hvis* det fungerer, svært lav *hvis* det forlates | Den største «swing for the fences»-muligheten. Høyest kostnad. Høyest varians. **STATUS: Gjenstår (backend ekskludert).**                                                                                 |
| **Story / Campaign mode** med 24–32 håndlagde nivåer, biome-progresjon og mini-boss-møter                                                                                                         | 8–12 uker   | Høy                                                          | Gjør spillet fra «score attack-leketøy» til «et *spill* jeg kan fullføre». En ekte hook for anmeldere. Men høy innholdskostnad — level design er flaskehalsen. **STATUS: Gjenstår (utsatt).** |
| **Spectator + replay studio** — ta opp runs, slow-motion, kameravinkler, eksport av 1080p-klipp                                                                                                   | 4–6 uker    | Høy *hvis* trick-systemet finnes                             | Trick system + replay studio sammen er det som gjorde *Trackmania* til en innholdsfabrikk. Uten tricks er replays bare runs. **STATUS: Gjenstår.** Trick-system og replay-eksport finnes nå — et fullt replay-studio (slow-mo, kameravinkler, 1080p-eksport) er fortsatt neste steg om dataene rettferdiggjør det.                                   |
| **Boss waves** — hver 1000 meter i Endless jager en boss-obstacle deg i 30 sekunder, for eksempel laserdrone, målsøkende missil eller fallende vrakrester. Overlev for å presse lavaen ned igjen. | 2–3 uker    | Middels                                                      | Bryter monotonien i endless-loopen. Gir YouTubere/streamere et tydelig «øyeblikk». **STATUS: Levert.** Hver 1000 m i Endless utløses en bølge med dødelig grus ovenfra, klaxon, advarselsbanner og kortvarig lavabremse som belønning. Se `triggerBossWave` i `src/game/Game.ts`.                                                                             |

### Tier C — Unngå

Eller gjør det bare hvis du spesifikt brenner for det.

| Idé                                                | Hvorfor hoppe over                                                                                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Flere skins / hooks / trails                       | Avtagende utbytte. Du har allerede 38 kosmetiske ting.                                                                                          |
| Flere achievements                                 | 30 er nok. Spillere kommer ikke tilbake for achievement nummer 35.                                                                              |
| VR / WebXR-modus                                   | CrazyGames er desktop+mobil-først. Feil plattform.                                                                                              |
| Native mobile-port, for eksempel Capacitor/Cordova | Legger til vedlikeholdskostnad. CrazyGames mobile dekker allerede dette publikummet.                                                            |
| Lokalisering                                       | Utsett til du har bevis på at ikke-engelske regioner faktisk beholder spillerne. Ordforrådet er lite nok til at engelsk er greit ved lansering. |

---

## Multiplayer spesifikt

Multiplayer er det du spurte om, så det fortjener en egen seksjon. Det finnes tre varianter, med svært ulike kostnadsprofiler. Velg feil, og du kan senke måneder uten avkastning.

### Variant 1 — Async ghost multiplayer

**Anbefalt hvis du gjør noen form for multiplayer.**

Du konkurrerer mot et *opptak* av en annen spillers run. De trenger ikke være online. Ghosten deres løper ved siden av deg, med navnet deres, og du ser forspranget øke eller krympe i sanntid.

**Hvordan det fungerer:**

* Serveren lagrer ghost-replays per daily seed, allerede encoded som `[px, py, hx, hy, hookActive]`-arrays.
* Ved daily-start returnerer serveren 1–3 ghosts fra spillere der tidligere best er innenfor ±10 % av ditt nivå.
* Klienten renderer dem som eksisterende personal-best-ghost, men tagget med motstanderens display name.
* End screen viser «You beat Sparky_22 by 1.4s» eller «Sparky_22 beat you by 0.8s».

**Kostnad:** 1–2 uker.
**Serverkostnad:** I praksis null. Cloudflare KV free tier håndterer millioner av lesinger. Hver ghost er cirka 5 KB.
**Sosial draeffekt:** Middels-høy. Å slå en *navngitt motstander* er psykologisk mye sterkere enn å slå «gjennomsnittlig score».
**Hvorfor dette først:** Det validerer at head-to-head er det publikum ønsker før du forplikter deg til sanntid. Hvis async ghosts ikke flytter retention, gjør sanntid det sannsynligvis heller ikke. Hvis det gjør det, blir sanntid en smart eskalering.

### Variant 2 — Sanntids-race

Den «ekte» multiplayeren.

2–8 spillere konkurrerer opp det samme prosedyregenererte tårnet samtidig. Lavaen jager alle. Første til en høyde vinner, eller siste overlevende vinner.

**Arkitekturalternativer:**

* **Peer-to-peer (WebRTC):** Null serverkostnad utover et signaling-endepunkt. Fungerer for 2–4 spillere. Sliter med NAT, særlig på mobil. Lett å jukse i. Ikke anbefalt.
* **Autoritativ server, liten Node + WebSocket:** Serveren kjører lava-timer og validerer posisjoner. Hver spiller sender posisjonsoppdateringer ved 20 Hz, serveren broadcaster til lobby. Cirka 5–20 dollar i måneden på en liten VPS for lav til middels trafikk. Bransjestandard. Anbefalt.
* **Serverless, Cloudflare Durable Objects:** Nyere mønster; én Durable Object-instans per lobby. Skalerer til null. Betal-per-bruk. Trolig 10–50 dollar i måneden for tusenvis av samtidige matcher. Verdt å undersøke.

**Kostnad:** 2–3 måneder for en polert, anti-cheat-bevisst versjon. 4–6 uker for en «god nok» v1 med åpenbare juksehull.

**Skjulte kostnader folk glemmer:**

* Matchmaking, enten ferdighetsbasert eller bare «hvem som helst online».
* Lobby-UI, inkludert venterom, ready-up og håndtering av å forlate.
* Disconnect-håndtering, altså ryddig oppførsel, ikke «lobbyen krasjer».
* Anti-cheat, for eksempel serverside validering av høyde/fart. Uten dette vil leaderboard-toppen være full av juksere innen 48 timer.
* Player reports / banlist.
* Lobby-chat eller emotes, eller et eksplisitt valg om å utelate det.
* Rematch-flow.
* «Friend invite»-lenke med deep-linking inn i privat lobby.
* Bot-fill hvis matchmaking er treg. Eksisterende `Bot.ts` er halve dette arbeidet.

**Realistisk utfall:**

Hvis spillet er godt nok til å støtte multiplayer, er sanntids-multiplayer det største mulige takløftet. *Smash Karts*, *1v1.LOL* og *JustFall.lol* ligger alle i multi-million-play-sjiktet *fordi* de er multiplayer. Singleplayer swing-physics-spill kommer sjelden dit.

Men: hvis spillet *ikke* er godt nok ennå til å rettferdiggjøre det, redder ikke multiplayer det. Det legger bare operasjonell kostnad oppå «ingen spiller».

**Den ærlige testen:** Hvis async ghost multiplayer, altså variant 1, øker retention med mer enn 30 % etter to uker med A/B-testbare data, er sanntid rettferdiggjort. Ellers ikke.

### Variant 3 — Co-op / samarbeid

To spillere i samme tårn, med en mekanikk som krever samarbeid, for eksempel rope-tether, å gjenopplive hverandre, eller å bytte på «fuel» til en felles hook.

**Kostnad:** Sammenlignbar med sanntids-race, 2–3 måneder, fordi netcode-kompleksiteten er lik.
**Oppside:** Mindre marked enn konkurransebasert multiplayer. Co-op .io-spill finnes, men de er i mindretall.
**Dom:** Lavere prioritet enn konkurranse. Kan være en «v3 expansion» etter at konkurransebasert multiplayer er etablert.

---

## «Tricks»-ideen i detalj

> **Levert i polish-runden.** Implementert i `src/systems/TrickSystem.ts`. Spesifikasjonen under er bevart som dokumentasjon av hva systemet gjør. Faktiske terskler (frame-vinduer, vinkelkrav, hastigheter) finnes i koden — denne tabellen beskriver intensjonen.

Min Tier A-satsing med aller høyest overbevisning.

Dette er verdt å utdype fordi jeg tror det er den mest oversette featuren for swing-physics-spill.

Selve grappling hook-*øyeblikket* er usynlig i skjermbilder. Spillere som gjør imponerende ting, ser identiske ut med spillere som gjør kjedelige ting, fordi UI-et ikke viser *hva* de nettopp gjorde.

**Spesifikasjon for trick-system:**

Ren fysikkdeteksjon av navngitte tricks under runs:

| Trick-navn    | Deteksjon                                                                               | Score-multiplikator |
| ------------- | --------------------------------------------------------------------------------------- | ------------------- |
| **Drop**      | Slipp hook på toppen av svingen → fritt fall gjennom ≥800 px → grapple igjen            | 1.5x                |
| **Whip**      | Tre hook-skudd på under 2 sekunder, der hver release-velocity er høyere enn den forrige | 2.0x                |
| **Pendulum**  | Én ankerfesting, swing-arc krysser >180° før release                                    | 1.3x                |
| **Wall Run**  | Treffer hinder horisontalt med fart >25, overfører til grapple innen 0.5 sekunder       | 1.8x                |
| **Threading** | Passerer innen near-miss-range av 3+ hindere i én luftbåren bue                         | 1.5x                |
| **Slingshot** | Reel-in mens du er festet, release ved full extension under reel                        | 1.6x                |
| **Skim**      | Passerer innen 2 px fra lava i mer enn 40 frames uten å dø                              | 2.5x                |

Spilleren ser trick-navnet kort midt på skjermen, for eksempel «WHIP +60», og en total/tally bygges opp. End-of-run viser trick breakdown.

**Hvorfor jeg har høy tro på dette:**

* Legger til navngitt *språk* for det spillet gjør. Spillere kan beskrive runs til venner.
* Løser skjermbilde-problemet — del et bilde med «WHIP COMBO ×4»-overlay.
* Bygger på eksisterende fysikk. Ingen nye store systemer, bare pattern matching mot spillerens tilstand per frame.
* Øker replay value. Akkurat nå er et 5000m-run et 5000m-run. Med tricks er et 4000m-run med tre Whips noe annet enn et rent 4000m-run.
* Trick-events går naturlig inn i share card-et som allerede er bygget.
* Lav risiko — hvis det ikke fungerer, har du lagt til noen hundre linjer kode, ikke en multiplayer-backend.

**Kostnad:** Cirka 2 uker. Høyest effekt per dag i hele listen.

---

## Ting dette spillet sannsynligvis *ikke* kan bli, selv med innsats

Dette er verdt å si tydelig, så du ikke jager spøkelser.

* **En massiv viral hit på nivå med Stickman Hook, cirka 100 millioner spillinger.** Det spillet traff en bølge i 2018–2019 da kategorien var tom. Den samme formen konkurrerer i dag mot dusinvis av swing-spill. Markedet har gått videre. Du kan bli *suksessfull* i denne kategorien, men du kan nesten garantert ikke bli så suksessfull.
* **En Steam-release.** Browser-fysikkspill gjør sjelden det spranget. De fleste som kjøper på Steam vil ha dybde og progresjon målt i timer, ikke minutter.
* **Et plattformdefinerende spill.** Det krever enten en merkevare eller en dyp sosial vollgrav — som *Among Us* eller *Fall Guys*. Ikke realistisk for et solo-indiespill.
* **En franchise.** Single-game-IP er vanskelig å utvide uten betydelig innholdsinvestering.

Dette er ikke pessimisme — det er bare å avgrense oppsiden slik at du ikke tar avgjørelser basert på et utfall som egentlig ikke er mulig.

---

## Hva dette spillet *kan* bli med riktige investeringer

I grov rekkefølge etter ambisjonsnivå:

1. **Et respektabelt indie-HTML5-spill** som tjener lave firesifrede årlige inntekter og finner 50 000–500 000 spillere. Oppnåelig med lansering + Tier S-arbeid.
2. **En liten hit på CrazyGames** i sjiktet 1–5 millioner spillinger. Oppnåelig med lansering + Tier S + én Tier A-feature, mest sannsynlig tricks eller async ghosts. 12–18 måneder deltidsarbeid.
3. **Et gjennombrudd** i 10M+-sjiktet. Krever sanntids-multiplayer *og* en sterk USP *og* litt flaks. 6–12 måneder fokusert arbeid. Reelt, men lav sannsynlighet.
4. **Et «lifestyle»-spill** med en gjentakende inntektsbase som finansierer deltidsarbeid på det. Mulig hvis multiplayer fungerer og retention er god. Krever jevnlige innholdsoppdateringer.

---

## Hva jeg faktisk ville gjort, i rekkefølge

Oppdatert mai 2026 etter polish-runden. Steg 1 og 3 er allerede levert (uten leaderboard-backenden, som er bevisst utelatt). Den oppdaterte planen er:

1. ~~**Denne uken:** deploy leaderboard-backenden, legg til 3–4 ekte lydeffekter, poler share-card-teksten. Send til CrazyGames.~~ *Lydeffekter og share-card-polering levert. Leaderboard-backend bevisst utelatt — daily-board er fortsatt local + cloud-save.*
2. **Nå:** *send til CrazyGames og følg med på dataene*. Ikke bygg noe stort. Se på: D1-/D7-retensjon, gjennomsnittlig øktlengde, modusfordeling, share button click rate, **clip-eksport-rate** (ny KPI etter replay-export), daily leaderboard submission rate, mobil-versus-desktop-splitt og geografisk fordeling.
3. ~~**Hvis D7-retensjon er over 8 %, eller daily submissions trender oppover:** bygg trick-systemet, Tier A, cirka 2 uker.~~ *Trick-systemet er levert allerede med 7 navngitte bevegelser. Følg med på trick-engasjement (callouts per run, share-tekst med trick-bragging) som signal på om det treffer.*
4. **Hvis tricks + replay-export løfter retention og share-rate:** vurder leaderboard-backend-deploy + async ghost multiplayer (krever da å akseptere backend). Hvis du fortsatt ikke vil ha backend, vurder course editor med share-codes (lokal UGC, ingen server).
5. **Først etter at steg 4 viser positivt signal:** forplikt deg til sanntids-multiplayer, cirka 3 måneder. Da er dette en investering rettferdiggjort av tre runder med akkumulerende data.
6. **Hvis tallene flater ut på et hvilket som helst steg:** stopp. Lanseringen er fin. Gå videre til neste prosjekt. Spillet overlever i long-tail-form uansett.

Dette er den disiplinerte versjonen. Hvert steg er en liten innsats med en tydelig test. Total forpliktelse er avgrenset på hvert trinn. Ikke «jeg bygger multiplayer fordi jeg håper det virker» — bare «jeg bygger multiplayer fordi dataene sier at det kan være riktig».

---

## Avsluttende merknad om token-/energikostnad

En reell vurdering: Hver time brukt her er en time som ikke brukes på et annet spill. Hvis et annet konsept faktisk er sterkere — bedre core hook, mindre mettet marked, mer sosialt design fra starten av — er riktig trekk å lansere Grapple Gliders slik det er og gå videre. Du har lært enormt mye fra dette bygget, og det akkumuleres inn i neste prosjekt.

Testen er: Se for deg at det er seks måneder fra nå, og Grapple Gliders har 30 000 spillinger og 80 dollar i inntekt. Er du glad for at du brukte enda en måned på å polere det, eller skulle du ønske at du hadde startet på det neste? Hvis det andre svaret er ærlig, lanser og gå videre.

Hvis du er usikker, lanser og følg med på data i en måned. Den avgjørelsen er reverserbar. Å senke tre måneder i multiplayer før lansering er det ikke.



# Road Ahead — Grapple Gliders

Strategic options for what to build next, ranked by realistic impact-vs-cost. Written as an honest assessment, not a wishlist. The premise: the game is technically ready, the question is whether more investment buys real upside or just polish nobody sees.

---

## Where the game actually stands

| Dimension | Status |
|---|---|
| Ship-ready (technical) | Yes. SDK, ads, cloud save, mobile, bundle size all green. |
| Ship-ready (commercial appeal) | Mid. Saturated category, no native social loop, swing-physics feel is invisible at thumbnail scale. |
| Realistic ceiling as-is | 5,000 – 200,000 plays lifetime. Long-tail revenue in low three figures. |
| Realistic floor as-is | Gets accepted into the catalog, gathers dust, ~$10–50 lifetime revenue. |
| Probability of breakout (>1M plays) | ~1–3%. Non-zero. Stickman Hook, Flappy Bird, Crossy Road all came from this shape. |
| Cost to ship as-is | Effectively zero. Submission is free, build is done. |
| Cost to ship and walk away | Zero. |
| Cost to keep iterating | Open-ended. |

**The strategic question is not "should I ship this." It is "having shipped this, do I keep building on it or move on?"** Those are separable decisions, and the second should be answered with *post-launch data*, not pre-launch hope.

---

## Status — pre-launch polish pass (May 2026)

The following landed in the pre-launch polish pass. Deliberate exclusion: no backend or multiplayer was built at this stage.

**Tier S — shipped:**

- **Replay export to WebM** via `MediaRecorder` on `canvas.captureStream(30)` with a rolling 30s cap. Web Share API on mobile, anchor-download elsewhere. Silent no-op on browsers without support. See `src/systems/RunRecorder.ts`.
- **Real sound effects:** distinct perfect-anchor chime, layered death sequence with sub-rumble + noise crash, level-up fanfare, ambient lava roar with proximity-modulated gain, boss klaxon, trick stab. All procedural — no new audio assets. See `src/audio/SFX.ts`.
- **End-of-run cosmetic preview:** "this run earned X toward Y" with a progress bar highlighting the run contribution in gold over the baseline cyan. See `src/systems/UnlockSystem.ts` + `src/ui/GameOverScreen.ts`.
- **Share-card polish:** NEW PB star badge, trick-chip row, gradient CTA, mode-aware bragging copy. See `src/ui/ShareCard.ts` + `src/ui/ShareScreen.ts`.

**Tier A — partial:**

- **Trick system:** physics-driven detection of Drop, Whip, Pendulum, Wall Run, Threading, Slingshot, Skim. Mid-run callout banner, combo-multiplied score bonus, end-of-run chip summary, share-card and share-text integration. Each trick has its own base score and chip color. See `src/systems/TrickSystem.ts` + `src/ui/TrickCallout.ts`.
- **2 new themes:** Lunar Drift (2200 Sparks) and Molten Core (2400 Sparks). Currently visual-only — no mechanical twists (low-gravity, reversed gravity) yet. See `src/content/themes.ts`.

**Tier B — partial:**

- **Boss waves in Endless:** every 1000 m triggers a wave of lethal jagged debris raining from above, with klaxon, warning banner, and a brief lava-slow reward window for surviving. Shield absorbs one impact. See `triggerBossWave` / `updateBossDebris` in `src/game/Game.ts`.

**Bundle:** 218 KB / 61 KB gzipped (+21 KB / +6 KB vs. baseline). Tests: 75/75 passing (12 new covering trick detection and the unlock-preview helper).

**Deliberately not shipped:** leaderboard backend deploy, async ghost multiplayer, weekly tournaments (all require backend); course editor (deferred as optional); a biome with an actual *mechanical* twist (the two new ones are visual only); story / campaign; real-time multiplayer; spectator / replay studio. The rest of the document below remains valid for prioritising the next round *after* launch data.

---

## Three honest paths

### Path 1 — Ship and walk
Treat the game as done. Submit to CrazyGames. Get data. Move on to the next concept with everything you learned here.

- **Cost:** ~1 day (submission paperwork, screenshots).
- **Upside:** modest plays, portfolio piece, real analytics.
- **Risk:** if the game *does* hit a nerve, you won't be there to capitalize.
- **When this is right:** if the game doesn't excite you anymore, or if you have a stronger concept queued up.

### Path 2 — Ship, then add one big feature based on data
Submit. Watch CrazyGames analytics for 2–4 weeks. If retention or DAU shows life, invest in *one* major feature targeted at the weakness the data reveals. If numbers are flat, walk away cleanly.

- **Cost:** 1 day now, then 1–4 weeks later if numbers justify it.
- **Upside:** investment is *earned* by data, not bet on hope. The right feature could 5–10x the ceiling.
- **Risk:** lowest of the three paths.
- **When this is right:** this is the recommended path for almost any indie HTML5 game.

### Path 3 — Pre-emptively build multiplayer / big feature now
Don't ship until the game has the social hook you think it needs. Bet that the bigger v1 will land harder than a smaller v1.

- **Cost:** 4–12 weeks depending on feature.
- **Upside:** if the big feature is the right one, the game launches with a real hook and can chart.
- **Risk:** highest. You're betting on a hypothesis you can't test until you've already paid for it. Most pre-emptive features end up being *not* what data would have told you to build.
- **When this is right:** when you have strong, specific conviction about what's missing — not "I should add multiplayer" but "I know exactly what multiplayer mode and I've sketched the UX."

**My recommendation: Path 2.** Ship the current version, give CrazyGames 3–4 weeks, then decide based on real numbers. Don't pre-commit to multiplayer or any other big bet without data behind it.

---

## Feature ideas ranked by ROI

Estimates assume the existing codebase. Days are calendar-days for an experienced solo dev who already knows the codebase.

### Tier S — High impact, low cost (do these *before* shipping if you have a day to spare)

| Feature | Cost | Impact | Why |
|---|---|---|---|
| Deploy the leaderboard backend (Cloudflare Worker template already exists) | 2–4 hours | High | The daily becomes a *real* competition instead of solo + bots. The infrastructure is already designed in `server/cloudflare-worker.ts`. Free tier is plenty for launch traffic. **STATUS: Pending (backend excluded).** |
| Replay export to WebM / animated PNG | 1–2 days | High | The single most-missing viral hook. A swing-physics game *should* have shareable clips, not just screenshots. Implemented via `MediaRecorder` on `canvas.captureStream()` — see `src/systems/RunRecorder.ts`. **STATUS: Shipped.** |
| Add 3–4 real sound effects (death, perfect anchor, lava roar) on top of the whip + soundtrack | 1 day | Medium-high | Audio is the cheapest perceived-quality lift. Shipped as procedural but layered and distinct: perfect-anchor chime, death + sub-rumble + noise crash, level-up fanfare, ambient lava roar, boss klaxon, trick stab. See `src/audio/SFX.ts`. **STATUS: Shipped.** |
| End-of-run cosmetic preview ("this run earned 47 Sparks toward Blade Hook") | 4 hours | Medium | Drives unlock spend and retention. Shipped as a progress bar with the run's contribution highlighted in gold over the baseline cyan. See `nextCheapestUnlock()` in `src/systems/UnlockSystem.ts`. **STATUS: Shipped.** |

### Tier A — Real upside, modest cost (1–3 weeks each)

| Feature | Cost | Impact | Why |
|---|---|---|---|
| **Trick system** — named moves (Drop, Pendulum, Slingshot, Wall-Ride) detected from physics state, multiplier scores, displayed mid-run with shareable replay tags | 2–3 weeks | High | Solves the "screenshots all look the same" problem. Shipped with 7 tricks: Drop, Whip, Pendulum, Wall Run, Threading, Slingshot, Skim — mid-run callout, score bonus, end-of-run summary, share-card integration. See `src/systems/TrickSystem.ts`. **STATUS: Shipped.** |
| **Async ghost multiplayer** — server-side ghost matchmaking: today's daily seed pairs you with a recorded run from someone within ±10% of your skill. Race against their replay live, alongside the lava | 1–2 weeks | High | Solves the social-pull problem with no real-time server cost. Just KV storage of ghost replays + a "find similar score" query. Leverages existing `personalBestGhost` encoding. **STATUS: Pending (backend excluded).** |
| **Course Editor + Share Code** — let players hand-craft Time Attack courses and share via 8-character codes. Workshop is optional; codes are enough | 2–3 weeks | High | UGC is the single most powerful retention multiplier on platforms like CrazyGames. The course-data format is already simple (see `src/content/timeAttackCourses.ts`). **STATUS: Deferred (optional).** |
| Weekly tournament mode — same seed for the whole week, prizes via Sparks / cosmetic | 1 week | Medium-high | A higher-stakes layer above the daily. Worth doing once the daily leaderboard backend is live. **STATUS: Pending (backend excluded).** |
| 2–3 more themed worlds with mechanical twists (low-gravity moon biome, reversed-gravity inverted tower, fog/visibility biome) | 1–2 weeks each | Medium | Each biome is one new *thing players talk about*. **STATUS: Partial.** Two new visual themes added (Lunar Drift, Molten Core) in `src/content/themes.ts`. Mechanical twists (low-grav, reversed gravity) still pending — the theme system is purely visual today and would need a `worldModifier` extension. |

### Tier B — Substantial commitment, conditional upside (1–3 months each)

| Feature | Cost | Impact | Why |
|---|---|---|---|
| **Real-time multiplayer race** (see dedicated section below) | 2–3 months | Very high *if* it works, very low *if* abandoned | Single biggest swing-for-the-fences. Highest cost. Highest variance. **STATUS: Pending (backend excluded).** |
| **Story / Campaign mode** with 24–32 hand-crafted levels, biome progression, mini-boss encounters | 8–12 weeks | High | Turns the game from "score attack toy" into "a *game* I can finish." A real reviewer hook. But high content cost — level design is the long pole. **STATUS: Pending (deferred).** |
| **Spectator + replay studio** — record runs, slow-mo, camera angles, export 1080p clips | 4–6 weeks | High *if* the trick system exists | Trick system + replay studio together is what made *Trackmania* a content factory. **STATUS: Pending.** Trick system and basic replay export both exist now — a full studio (slow-mo, camera angles, 1080p export) is the next step if data justifies it. |
| **Boss waves** — every 1000m in Endless, a boss obstacle pursues you for 30s (laser drone, homing missile, falling debris). Survive to break the lava back down | 2–3 weeks | Medium | Breaks the monotony of the endless loop. Gives YouTubers/streamers a "moment." **STATUS: Shipped.** Every 1000 m in Endless spawns lethal jagged debris from above with klaxon, warning banner, and brief lava-slow reward. See `triggerBossWave` in `src/game/Game.ts`. |

### Tier C — Avoid (or do only if specifically excited)

| Idea | Why skip |
|---|---|
| More skins / hooks / trails | Diminishing returns. You already have 38 cosmetics. |
| More achievements | 30 is plenty. Players don't return for achievement 35. |
| VR / WebXR mode | CrazyGames is desktop+mobile-first. Wrong platform. |
| Native mobile port (Capacitor/Cordova) | Adds maintenance overhead. CrazyGames mobile already covers this audience. |
| Localisation | Defer until you have evidence non-English regions retain. The vocabulary is small enough that English-only is fine for launch. |

---

## Multiplayer specifically

Multiplayer is what you asked about, so it deserves its own section. There are three flavours, with very different cost profiles. Pick the wrong one and you sink months for no return.

### Flavour 1 — Async ghost multiplayer (RECOMMENDED IF YOU DO ANY MULTIPLAYER)

You race against a *recording* of another player's run. They don't need to be online. Their ghost runs alongside you, with their name, and you see the gap close or widen in real time.

**How it works:**
- Server stores ghost replays per daily seed (already encoded as `[px, py, hx, hy, hookActive]` arrays).
- On daily start, server returns 1–3 ghosts from players whose previous best is within ±10% of yours.
- Client renders them like the existing personal-best ghost, but tagged with the opponent's display name.
- End screen shows "You beat Sparky_22 by 1.4s" or "Sparky_22 beat you by 0.8s."

**Cost:** 1–2 weeks.
**Server cost:** essentially zero. Cloudflare KV free tier handles millions of reads. Each ghost is ~5KB.
**Social pull:** moderate-high. Beating a *named opponent* is psychologically much stronger than beating "average score."
**Why this first:** validates that head-to-head is what the audience wants, before committing to real-time. If async ghosts don't move retention, real-time probably won't either. If they do, real-time becomes a smart escalation.

### Flavour 2 — Real-time race (the "real" multiplayer)

2–8 players race up the same procedurally generated tower simultaneously. Lava chases everyone. First to a height target wins, or last standing wins.

**Architecture options:**
- **Peer-to-peer (WebRTC):** zero server cost beyond a signaling endpoint. Works for 2–4 players. Suffers under NAT, especially on mobile. Cheating-prone. Not recommended.
- **Authoritative server (small Node + WebSocket):** server runs the lava timer and validates positions. Each player sends position updates @ 20Hz, server broadcasts to lobby. ~$5–20/month on a small VPS for low-to-mid traffic. Industry-standard. Recommended.
- **Serverless (Cloudflare Durable Objects):** newer pattern; one DO instance per lobby. Scales to zero. Pay-per-use. Probably $10–50/mo for thousands of concurrent matches. Worth investigating.

**Cost:** 2–3 months for a polished, anti-cheat-aware version. 4–6 weeks for a "good enough" v1 with obvious cheating gaps.

**Hidden costs people forget:**
- Matchmaking (skill-based or just "anyone online").
- Lobby UI (waiting room, ready-up, leave handling).
- Disconnect handling (graceful, not "the lobby crashes").
- Anti-cheat (server-side validation of altitude/speed; without this, top of leaderboard is all cheaters within 48 hours).
- Player reports / banlist.
- Lobby chat or emotes (or explicit choice to omit).
- Re-match flow.
- "Friend invite" link with deep-linking into a private lobby.
- Bot fill (if matchmaking is slow, fill with AI bots — the existing Bot.ts is half this work).

**Realistic outcome:**
If the game is good enough to support multiplayer, real-time multiplayer is the single biggest possible ceiling lift. *Smash Karts*, *1v1.LOL*, *JustFall.lol* all sit in the multi-million-play tier *because* they're multiplayer. Single-player swing-physics games don't get there.

But: if the game *isn't* good enough yet to justify it, multiplayer doesn't save it — it just adds operational cost on top of "nobody's playing."

**The honest test:** if async ghost multiplayer (Flavour 1) bumps retention by >30% after 2 weeks of A/B-able data, real-time is justified. Otherwise it isn't.

### Flavour 3 — Co-op / collaborative

2 players on the same tower, with a mechanic that requires cooperation (rope-tether, reviving each other, alternating "fuel" to a shared hook, etc.).

**Cost:** comparable to real-time race (2–3 months) because the netcode complexity is similar.
**Upside:** smaller market than competitive multiplayer. Co-op .io games exist but they're a minority.
**Verdict:** lower priority than competitive. Could be a "v3 expansion" after competitive multiplayer is established.

---

## The "tricks" idea in detail (my single highest-conviction Tier-A bet)

> **Shipped in the polish pass.** Implemented in `src/systems/TrickSystem.ts`. The spec below is kept as documentation of what the system does. Actual thresholds (frame windows, arc angles, speeds) live in the code — this table describes intent.

Worth elaborating because I think this is the most-overlooked feature for swing-physics games.

The grappling-hook *moment* is invisible in screenshots. Players doing impressive things look identical to players doing boring things, because there's no UI affordance for *what* they just did.

**Trick system specification:**

Pure-physics detection of named tricks during runs:

| Trick name | Detection | Score multiplier |
|---|---|---|
| **Drop** | Release hook at apex of swing → free-fall through ≥800px → re-grapple | 1.5x |
| **Whip** | Three hook fires in <2s with each release-velocity higher than the last | 2.0x |
| **Pendulum** | Single anchor, swing arc crosses >180° before release | 1.3x |
| **Wall Run** | Touch obstacle horizontally at speed >25, transfer to grapple within 0.5s | 1.8x |
| **Threading** | Pass within near-miss range of 3+ obstacles in a single airborne arc | 1.5x |
| **Slingshot** | Reel-in while attached, release at full extension during reel | 1.6x |
| **Skim** | Pass within 2px of lava (>40 frames) without dying | 2.5x |

Players see the trick name briefly mid-screen (e.g. "WHIP +60") and a tally accumulates. End-of-run shows the trick breakdown.

**Why this is high-conviction:**
- Adds named *language* for what the game is doing. Players can describe runs to friends.
- Solves the screenshot problem — share an image with "WHIP COMBO ×4" overlay.
- Built on existing physics. No new systems, just pattern matching against player state per frame.
- Multiplies replay value. Currently a 5000m run is a 5000m run. With tricks, a 4000m run with three Whips is different from a clean 4000m run.
- Trick events feed naturally into the share card already built.
- Low risk — if it doesn't work, you've added a few hundred lines of code, not a multiplayer backend.

**Cost:** ~2 weeks. Highest impact-per-day in the whole list.

---

## Things this game probably *cannot* become, even with effort

Worth saying clearly so you don't chase ghosts.

- **A massive viral hit on the scale of Stickman Hook (~100M plays).** That game caught a wave in 2018–2019 when the category was empty. The same shape today competes with dozens of swing games. The market has moved on. You can be *successful* in this category, but you almost certainly cannot be that successful.
- **A Steam release.** Browser physics games rarely make the jump. Most people who buy on Steam want depth and progression measured in hours, not minutes.
- **A platform-defining game.** That requires either a brand or a deep social moat — *Among Us*, *Fall Guys*. Not realistic for a solo indie game.
- **A franchise.** Single-game IP is hard to extend without significant content investment.

This isn't pessimism — it's just bounding the upside so you don't make decisions for an outcome that isn't possible.

---

## What this game *can* become with the right investments

In rough order of ambition:

1. **A respectable indie HTML5 game** that earns a low-four-figure annual revenue and finds 50–500k players. Achievable with shipping + Tier S work.
2. **A small-hit on CrazyGames** in the 1–5M plays tier. Achievable with shipping + Tier S + one Tier A feature (most likely tricks or async ghosts). 12–18 months of part-time work.
3. **A breakout** in the 10M+ plays tier. Requires real-time multiplayer *and* a strong USP *and* some luck. 6–12 months of focused work. Real but low-probability outcome.
4. **A "lifestyle" game** with a recurring revenue base that funds part-time work on it. Possible if multiplayer takes and retention is good. Requires sustained content updates.

---

## What I'd actually do, in order

Updated May 2026 after the polish pass. Steps 1 and 3 already shipped (without the leaderboard backend, which is deliberately excluded). The updated plan:

1. ~~**This week:** deploy the leaderboard backend, add 3–4 real sound effects, polish the share-card text. Submit to CrazyGames.~~ *SFX and share-card polish shipped. Leaderboard backend deliberately excluded — the daily board is still local + cloud-save.*
2. **Now:** *submit to CrazyGames and watch the data*. Don't build anything major. Look at: D1/D7 retention, average session length, mode distribution, share-button click rate, **clip-export rate** (new KPI after the replay export), daily-leaderboard submission rate, mobile-vs-desktop split, geographic distribution.
3. ~~**If D7 retention > 8% or daily submissions trend upward**: build the trick system (Tier A, ~2 weeks).~~ *Trick system already shipped with 7 named moves. Watch trick engagement (callouts per run, trick-bragging in share text) as the signal that it lands.*
4. **If tricks + replay export lift retention and share rate**: consider deploying the leaderboard backend + async ghost multiplayer (requires accepting backend at that point). If you still don't want backend, consider the course editor with share codes (local UGC, no server).
5. **Only after step 4 shows positive signal**: commit to real-time multiplayer (3 months). This is now an investment justified by three rounds of compounding data.
6. **If at any step the numbers flatten**: stop. Ship is fine. Move to next project. The game survives in long-tail form regardless.

This is the disciplined version. Each step is a small bet with a clear test. Total commitment is bounded at every stage. No "I'll build multiplayer because I hope it works" — only "I'll build multiplayer because the data says it might."

---

## Final note on token / energy cost

A real consideration: every hour spent here is an hour not spent on a different game. If a different concept is genuinely stronger (better core hook, less saturated market, more social by design), the right move is to ship Grapple Gliders as-is and move on. You'll have learned an enormous amount from the build that compounds into the next project.

The test: imagine it's 6 months from now and Grapple Gliders has 30,000 plays and $80 revenue. Are you glad you spent another month polishing it, or do you wish you'd started the next thing? If the second answer is honest, ship and move.

If you're not sure, ship and watch the data for a month. That decision is reversible. Sinking 3 months into multiplayer pre-launch is not.
