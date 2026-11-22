# Studio, la tua app di studio per iPhone

Calendario di studio con materie, esami, argomenti, piano automatico fino all'esame, timer, note e progressi.
I dati restano solo sul tuo iPhone: il sito serve solo a scaricare l'app, non riceve niente di quello che scrivi.

## Metterla online con GitHub Pages (gratis)

1. Crea un account su github.com (se non ce l'hai).
2. In alto a destra tocca **+** e poi **New repository**. Nome: `studio`. Lascialo **Public** e premi **Create repository**.
3. Nella pagina del repository tocca **uploading an existing file** e trascina **tutto il contenuto** di questa cartella
   (index.html, app.js, app.css, icons.js, sw.js, manifest.json e le cartelle `icons` e `fonts`).
   Importante: i file devono stare nella radice del repository, non dentro un'altra cartella. Poi **Commit changes**.
4. Vai su **Settings**, poi **Pages**. In "Branch" scegli **main** e la cartella **/ (root)**, poi **Save**.
5. Dopo 1-2 minuti l'app è su `https://TUONOME.github.io/studio/`.

## Installarla sull'iPhone

1. Apri quel link con **Safari**.
2. Tocca **Condividi** (su iOS 26 è nel menu ⋯ in basso) e poi **Aggiungi alla schermata Home**.
3. Lascia attivo "Apri come app web" e conferma.

Dopo la prima apertura funziona anche senza internet.

## Aggiornare l'app

Se cambi i file su GitHub, apri `sw.js` e aumenta il numero di versione (`studio-v1` diventa `studio-v2`).
L'iPhone scarica la nuova versione la prossima volta che apri l'app con internet. I dati non si toccano.

## Backup

Impostazioni (rotellina nel calendario) e poi **Esporta backup**: salva il file in File o iCloud Drive.
Se cancelli l'icona dalla Home, i dati si cancellano con lei: con il backup li recuperi da **Importa backup**.

## Note tecniche

- Il codice è pubblico su GitHub (con l'account gratuito Pages funziona solo con repository pubblici), ma non contiene dati tuoi.
- Font: Bricolage Grotesque e IBM Plex Sans (licenza SIL OFL), inclusi nella cartella `fonts`. Icone: Lucide (licenza ISC).
- Per cambiare il nome sotto l'icona: `manifest.json` (name, short_name) e `index.html` (apple-mobile-web-app-title).
