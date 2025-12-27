# Note sulla creazione del database

## Rinomina della tabella LIKE
Durante la fase di test su pgAdmin è emerso un errore di esecuzione dovuto
all’utilizzo del nome `LIKE`, che è una parola riservata in SQL.
Per questo motivo la tabella è stata rinominata in `MI_PIACE`.

## Coerenza tra dati e applicazione
Durante lo sviluppo e il popolamento del database, la struttura e i dati
sono stati adattati per riflettere in modo coerente la modalità con cui
le informazioni vengono visualizzate e gestite nell’applicazione,
anche dopo la creazione dinamica di nuovi contenuti tramite API.

In particolare è stata curata:
- la coerenza dei formati
- l’utilizzo di valori di default
- il rispetto delle relazioni tra tabelle

Questo ha permesso di evitare discrepanze tra i dati di test e il
funzionamento reale dell’applicazione.

## Gestione delle password
Inizialmente erano state inserite password in chiaro, ma ciò impediva
il login poiché il sistema confronta gli input con hash generati tramite
`crypto.scrypt`.

Per simulare correttamente il comportamento del sistema di autenticazione,
è stato creato temporaneamente uno script Node.js per generare hash compatibili
con quelli utilizzati in produzione.

### Script utilizzato (successivamente rimosso)

```bash
const crypto = require('crypto')

const password = '(username)123'
const salt = crypto.randomBytes(16).toString('hex')

crypto.scrypt(password, salt, 64, (err, derivedKey) => {
    if (err) throw err
    const hashed = derivedKey.toString('hex') + '.' + salt
    console.log(hashed)
})
```

Gli hash generati sono stati inseriti direttamente nella tabella Utente,
rendendo possibile testare correttamente il login anche con dati pre-popolati.

