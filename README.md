# Piccola Pressa

Web app leggera per ridimensionare immagini e convertirle in WebP. L’elaborazione avviene interamente nel browser: i file non vengono caricati su un server.

## Utilizzo

Apri `Piccola pressa/index.html` in un browser aggiornato, trascina più file o un’intera cartella di immagini JPG, PNG o WebP, oppure usa **Seleziona cartella**. Scegli il metodo di ridimensionamento e la qualità, quindi scegli **Converti immagini in WebP**. Con **Dimensioni esatte**, l’anteprima mostra l’inquadratura: trascina la finestra di ritaglio (oppure selezionala e usa le frecce) per scegliere l’area da mantenere; ogni immagine conserva la propria inquadratura e **Ricentra l’inquadratura** riporta il ritaglio al centro. Il riquadro nella sezione **Dimensioni esatte** mostra in tempo reale la porzione selezionata, con il preset riconosciuto (T&I o Innoeco) e le dimensioni finali. Dopo la conversione, ogni risultato riporta peso iniziale, peso WebP e variazione effettiva; scarica i file singolarmente o insieme in uno ZIP.

La modalità **Lato massimo** è predefinita a 1000 px: il lato più lungo non supera il limite, le proporzioni restano invariate e le immagini più piccole non vengono ingrandite. La modalità **Dimensioni esatte** permette di impostare larghezza e altezza oppure scegliere i preset T&I (1486 × 992 px) e Innoeco (1080 × 810 px). Se i rapporti differiscono, l’immagine viene ritagliata al centro per riempire le dimensioni richieste: l’inquadratura resta trascinabile per singola immagine e non è obbligatorio modificarla. Il limite per immagine è 30 MB.

## Requisiti

Nessuna installazione o server necessari. È richiesto un browser moderno con supporto a Canvas e WebP. Per avviarla in locale basta aprire `Piccola pressa/index.html`. La creazione dello ZIP usa fflate 0.8.2 da jsDelivr e richiede una connessione internet; la conversione delle immagini resta locale e i file non vengono caricati.

## Pubblicazione su GitHub Pages

Il workflow in `.github/workflows/deploy-pages.yml` pubblica automaticamente il sito a ogni push sul branch `main`.

1. Crea un repository GitHub pubblico e carica in esso i file di questo progetto.
2. In **Settings > Pages**, seleziona **GitHub Actions** come sorgente di pubblicazione.
3. Attendi il completamento del workflow **Deploy Piccola Pressa** nella scheda **Actions**.

L’indirizzo del sito sarà `https://<nome-account>.github.io/<nome-repository>/`. Il repository pubblico rende visibile il codice sorgente a tutti; le immagini selezionate nell’app restano invece sul dispositivo e non vengono caricate.
