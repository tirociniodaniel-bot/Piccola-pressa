# Piccola Pressa

Web app leggera per ridimensionare immagini e convertirle in WebP. L’elaborazione avviene interamente nel browser: i file non vengono caricati su un server.

## Utilizzo

Apri `index.html` in un browser aggiornato, trascina o seleziona un file JPG, PNG o WebP, imposta la larghezza massima e la qualità, quindi scegli **Converti in WebP** e scarica il risultato.

La larghezza predefinita è 1000 px. L’altezza viene calcolata mantenendo le proporzioni; le immagini più piccole non vengono ingrandite. Il limite per immagine è 30 MB.

## Requisiti

Nessuna installazione o server necessari. È richiesto un browser moderno con supporto a Canvas e WebP. Per avviarla in locale basta aprire `index.html`.

## Pubblicazione su GitHub Pages

Il workflow in `.github/workflows/deploy-pages.yml` pubblica automaticamente il sito a ogni push sul branch `main`.

1. Crea un repository GitHub pubblico e carica in esso i file di questo progetto.
2. In **Settings > Pages**, seleziona **GitHub Actions** come sorgente di pubblicazione.
3. Attendi il completamento del workflow **Deploy Piccola Pressa** nella scheda **Actions**.

L’indirizzo del sito sarà `https://<nome-account>.github.io/<nome-repository>/`. Il repository pubblico rende visibile il codice sorgente a tutti; le immagini selezionate nell’app restano invece sul dispositivo e non vengono caricate.
