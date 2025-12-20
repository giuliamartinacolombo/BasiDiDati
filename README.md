# 📸 Fotogram API

Backend REST API per **Fotogram**, un social network per la condivisione di contenuti testuali e immagini, sviluppato come progetto d’esame per il corso di **Basi di Dati e Web** (2024/2025).
Il progetto comprende la progettazione della base di dati, l’implementazione delle API REST e la documentazione completa delle funzionalità offerte.

---

## 🧠 Descrizione del progetto

Fotogram è un social network che consente agli utenti di:
- registrarsi e autenticarsi tramite username e password
- seguire altri utenti con una relazione asimmetrica (stile Twitter)
- pubblicare post testuali oppure post con immagine
- visualizzare una bacheca con i post propri e degli utenti seguiti
- mettere e rimuovere like ai post
- segnalare (flag) contenuti ritenuti inappropriati
- visualizzare profili utente e relative statistiche
- gestire ruoli di **amministratore** e **moderatore**
- moderare i post segnalati

Il sistema applica diversi vincoli di sicurezza e di integrità, tra cui:
- unicità di username ed email
- password cifrate tramite `crypto.scrypt`
- una sola sessione attiva per utente
- limite alla pubblicazione di nuovi post per utenti con contenuti moderati
- dimensione massima delle immagini: **100 KB**

---

## 🏗️ Architettura del sistema

- **Backend:** Node.js + Express  
- **Database:** PostgreSQL  
- **Autenticazione:** JWT (JSON Web Token)  
- **Documentazione API:** Swagger  
- **Gestione upload immagini:** express-fileupload  

---

## 🗄️ Progettazione della base di dati

La progettazione è stata svolta seguendo tutte le fasi richieste:
- schema **E-R**
- schema **E-R ristrutturato**
- schema **relazionale**
- definizione di vincoli di integrità e scelte progettuali motivate

File inclusi nel progetto:
- `ER.png`
- `ER-ristrutturato.png`
- `ER.er`
- `documentazione.txt`
- `creazione.txt`

Nota: la tabella `LIKE` è stata rinominata in `MI_PIACE` per evitare conflitti con parole riservate SQL.

---

## 🔐 Autenticazione e sicurezza

- Registrazione con controllo di unicità di username ed email
- Password cifrate con **salt + scrypt**
- Login con generazione di token JWT (scadenza 1 ora)
- Logout con chiusura esplicita della sessione nel database
- Middleware di autenticazione per la protezione degli endpoint riservati

---

## 🔌 API REST – funzionalità principali

### Autenticazione
- `POST /registrazione` – registrazione nuovo utente
- `POST /login` – login e generazione JWT
- `POST /logout` – logout e chiusura sessione

### Profilo utente
- `PATCH /profilo` – modifica mail e/o password
- `POST /profilo/foto` – aggiornamento immagine profilo

### Utente
- `GET /utente/:username` – visualizzazione profilo utente
- `GET /utente/search` – ricerca utenti per username

### Admin e Moderatori
- `POST /admin/promozione` – promozione utente a moderatore
- `DELETE /admin/promozione/:username` – rimozione moderatore
- `GET /admin/moderatori` – lista dei moderatori

### Follow e Unfollow
- `POST /follow/:username` – segui un utente
- `DELETE /follow/:username` – smetti di seguire un utente
- `GET/followers` - ottieni la lista dei tuoi follower
- `GET/followed` - ottieni la lista dei tuoi seguiti

### Post
- `POST /post` - crea un nuovo post
- `DELETE /post/:id_post` - elimina un post (solo autore
- `GET /bacheca` - Ottieni la bacheca degli utenti seguiti e dei propri post, impaginata dal post più recente

### Like
- `POST /like/:id_post` - Metti like a un post
- `DELETE /like/:id_post` - Rimuovi like da un post

### Flag
- `POST /flag/:id_post` - Segnala un post come inappropriato (flag)
- `DELETE /flag/:id_post` - Rimuovi flag (segnalazione) da un post

### Moderazione
- `GET /moderazione/flag` - Lista dei post flaggati ancora da moderare
- `PATCH /moderazione/:id_post` - Modera un post flaggato
- `GET /moderazione/post` - Lista dei post moderati

La descrizione dettagliata di endpoint, parametri, risposte e query SQL è contenuta nel file `documentazione.txt`.

---

## 📑 Documentazione Swagger

Il server sarà disponibile su: http://localhost:3000
La configurazione Swagger è generata automaticamente tramite `swagger-autogen`.

---

## ▶️ Avvio del progetto

### Prerequisiti
- Node.js (versione ≥ 18)
- PostgreSQL
- Database PostgreSQL denominato `Fotogram`

### Installazione dipendenze
```bash
npm install
```

### Avvio del server
```bash
node index.js
```

## 📦 Dipendenze principali
- express
- pg
- jsonwebtoken
- express-fileupload
- swagger-ui-express
- swagger-autogen

## 📄 Licenza
Questo progetto è distribuito sotto licenza MIT.
