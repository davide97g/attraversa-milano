# Attraversa Milano

Gioco della serie "Videogiochi della mia infanzia". Arcade a salti infinito in 3D low-poly: un piccione attraversa
Milano a dicembre. Parchi con alberi, fontanelle e fioriere che bloccano; strade con auto, Vespe, Ape e bus;
binari del tram (semaforo che lampeggia + campanella prima del passaggio); Navigli da attraversare sulle barche.
La camera avanza da sola: chi resta indietro lo porta via la spazzatrice. Monete raccolte in tutto sbloccano
personaggi (papera, gatto, pinguino in sciarpa, panettone).

Three.js, modelli fatti di primitive (`src/models.ts`), effetti e musica (valzerino da balera) generati con
Web Audio (`src/audio.ts`), classifica condivisa della serie (`src/scores.ts`, GAME = attraversa-milano).

```sh
bun run build   # dist/
bun run dev     # build + http://localhost:5182
bun run check   # typecheck
```

Comandi: frecce / WASD saltano, M audio, P pausa. Telefono: tocca = avanti, scorri = direzione.
