//Creazione e configurazipne di una connessione al database PostgreSQL tramite il modulo pg
const pg = require('pg')
const pool = new pg.Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Fotogram',
    password: 'password',
    port: 5432
})

// Per una spiegazione dettagliata delle scelte progettuali relative alle API e alla loro implementazione in Node.js, si veda il file documentazione.txt (parte finale)

// Middleware di autenticazione JWT:
// Verifica la validità del token, aggiorna la sessione se scaduto e salva l'username nel campo req.user se il token è valido
const auth = (req, res, next) => {
    const token = req.headers['bearer']

    if (!token)
        return res.status(400).send({ error: 'Token mancante.' })

    jwt.verify(token, jwt_secret, (err, payload) => {
        if (err) {
            // Se il token è scaduto, aggiorna la fine_sessione
            if (err.name === 'TokenExpiredError') {
                const sessionId = token; // l'id_sessione è proprio il token salvato nel DB
                const updateQuery = `
                    UPDATE login
                    SET fine_sessione = CURRENT_TIMESTAMP
                    WHERE id_sessione = $1 AND fine_sessione IS NULL
                `;
                pool.query(updateQuery, [sessionId]).then(() => {
                    return res.status(401).send({ error: 'Token scaduto. Esegui di nuovo il login.' })
                }).catch(() => {
                    return res.status(500).send({ error: 'Errore interno.' })
                });
            } else {
                return res.status(401).send({ error: 'Token non valido.' })
            }
        } else {
            req.user = payload.username;
            next();
        }
    })
}

//Endpoint POST/registrazione
const crypto = require('crypto'); // modulo interno per la crittografia
const postRegistrazione = (req, res) => {
    // #swagger.tags = ['Autenticazione']
    // #swagger.summary = 'Registra un nuovo utente'
    /* #swagger.requestBody = {
        required: true,
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    properties: {
                        username: { type: "string" },
                        mail: { type: "string", format: "email" },
                        password: { type: "string" }
                    },
                    required: ["username", "mail", "password"]
                }
            }
        }
    } */
    // #swagger.responses[201] = { description: 'Created' }
    // #swagger.responses[400] = { description: 'Bad Request' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }


    // Aggiunto controllo sul formato dell'email per garantire che il campo "mail"
    // rispetti una struttura valida (es. nome@dominio.ext) e prevenire inserimenti errati.
    // L'errore viene gestito insieme agli altri parametri mancanti o non validi.
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!req.body || !req.body.username || !req.body.mail || !emailRegex.test(req.body.mail) || !req.body.password)
        return res.status(400).send({ error: 'Parametri mancanti o non validi.' })

    const checkQuery = `
        SELECT EXISTS (
            SELECT *
            FROM utente
            WHERE username = $1 OR mail = $2
        )`;
    const checkValues = [req.body.username, req.body.mail]

    pool.query(checkQuery, checkValues).then(result => {
        if (result.rows[0].exists) {
            return res.status(400).send({ error: 'Username o email già in uso.' })
        }

        const salt = crypto.randomBytes(16).toString('hex'); // salt personale

        crypto.scrypt(req.body.password, salt, 64, (err, hash) => {
            if (err) return res.status(500).send({ error: 'Errore nella query.' })

            const insertQuery = `
                INSERT INTO utente (username, mail, password, num_follower, num_followed)
                VALUES ($1, $2, $3, 0, 0)
                RETURNING username;
            `;
            const insertValues = [req.body.username, req.body.mail, hash.toString('hex') + '.' + salt]

            pool.query(insertQuery, insertValues).then(() => {
                return res.status(201).send({ message: 'Registrazione avvenuta con successo.' })
            }).catch(err => {
                return res.status(500).send({ error: 'Errore nella query.' })
            });
        });
    }).catch(err => {
        return res.status(500).send({ error: 'Errore nella query.' })
    })
}

//Endpoint POST/login
const jwt = require('jsonwebtoken');
const jwt_secret = 'FotogramSecretKey123' // chiave segreta per la firma dei token JWT

const postLogin = (req, res) => {
    // #swagger.tags = ['Autenticazione']
    // #swagger.summary = 'Effettua il login di un utente'
    /* #swagger.requestBody = {
        required: true,
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    properties: {
                        username: { type: "string" },
                        password: { type: "string" }
                    },
                    required: ["username", "password"]
                }
            }
        }
    } */
    // #swagger.responses[200] = { description: 'OK' }
    // #swagger.responses[400] = { description: 'Bad Request' }
    // #swagger.responses[401] = { description: 'Unauthorized' }
    // #swagger.responses[409] = { description: 'Conflict' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }

    if (!req.body || !req.body.username || !req.body.password)
        return res.status(400).send({ error: 'Parametri mancanti.' })

    const query = `
        SELECT password
        FROM utente
        WHERE username = $1
    `;
    const values = [req.body.username];

    pool.query(query, values).then(result => {
        if (result.rows.length === 0)
            return res.status(401).send({ error: 'Username o password errati.' })

        const [hpass, salt] = result.rows[0].password.split('.')

        crypto.scrypt(req.body.password, salt, 64, (err, hash) => {
            if (hash.toString('hex') !== hpass)
                return res.status(401).send({ error: 'Username o password errati.' })

            //Controlla se esiste già una sessione aperta
            const sessionCheckQuery = `
                SELECT 1
                FROM login
                WHERE username = $1 AND fine_sessione IS NULL
                LIMIT 1
            `;
            pool.query(sessionCheckQuery, [req.body.username]).then(sessionResult => {
                if (sessionResult.rows.length > 0) {
                    return res.status(409).send({ error: 'Esiste già una sessione attiva per questo utente.' })
                }

                const payload = { username: req.body.username };
                const token = jwt.sign(payload, jwt_secret, { expiresIn: '1h' })

                const insertLoginQuery = `
                    INSERT INTO login (id_sessione, inizio_sessione, username)
                    VALUES ($1, CURRENT_TIMESTAMP, $2)
                `;
                const loginValues = [token, req.body.username]
                pool.query(insertLoginQuery, loginValues).then(() => {
                    return res.status(200).send({ token: token })
                }).catch(err => {
                    return res.status(500).send({ error: 'Errore durante la registrazione della sessione.' })
                });
            }).catch(() => {
                return res.status(500).send({ error: 'Errore durante il controllo della sessione.' })
            });
        });
    }).catch(() => {
        return res.status(500).send({ error: 'Errore nella query.' })
    })
}

//Endpoint POST/logout
const postLogout = (req, res) => {
    // #swagger.tags = ['Autenticazione']
    // #swagger.summary = 'Effettua il logout di un utente'    
    // #swagger.responses[200] = { description: 'OK' }
    // #swagger.responses[400] = { description: 'Bad Request' }
    // #swagger.responses[401] = { description: 'Unauthorized' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }

    const token = req.headers['bearer'] // Il token è l'id_sessione

    const query = `
        UPDATE login
        SET fine_sessione = CURRENT_TIMESTAMP
        WHERE id_sessione = $1 AND fine_sessione IS NULL
    `; // aggiorno la sessione corrente dell'utente
    pool.query(query, [token]).then((results) => {
        return res.send({ message: 'Logout effettuato con successo.' })
    }).catch((err) => {
        return res.status(500).send({ error: 'Errore durante il logout.' })
    })
}
    
//Endpoint PATCH/profilo
const patchProfilo = (req, res) => {
    // #swagger.tags = ['Profilo Utente']
    // #swagger.summary = 'Modifica mail o password del profilo utente'
    /* #swagger.requestBody = {
        required: true,
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    properties: {
                        mail: { type: "string", format: "email" },
                        password: { type: "string", minLength: 1 }
                    }
                }
            }
        }
    } */
    // #swagger.responses[200] = { description: 'OK' }
    // #swagger.responses[400] = { description: 'Bad Request' }
    // #swagger.responses[401] = { description: 'Unauthorized' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }

    const params = {}

    if(req.body.mail !== undefined) {
        // Validazione mail
        const mailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!mailRegex.test(req.body.mail)){
            return res.status(400).send({ error: 'Email non valida.'})
        }
        params.mail = req.body.mail
    }    
    if (req.body.password !== undefined) {
        // Validazione password
        if (req.body.password.length < 1){
            return res.status(400).send({ error: 'Password troppo corta.' })
        }
        params.password = req.body.password
    }

    // Nessun dato valido
    if (Object.keys(params).length === 0)
        return res.status(400).send({ error: 'Nessun dato fornito.' });

    if (params.password !== undefined) {
        const salt = crypto.randomBytes(16).toString('hex');
        crypto.scrypt(req.body.password, salt, 64, (err, hash) => {
            if (err) return res.status(500).send({ error: 'Errore nella query.' }) 

            const hashed = hash.toString('hex') + '.' + salt;

            //Mail e password
            if (params.mail) {
                const query = `
                    UPDATE utente
                    SET mail = $1, password = $2
                    WHERE username = $3
                `;
                const values = [params.mail, hashed, req.user];
                pool.query(query, values)
                    .then(() => res.send({ message: 'Profilo aggiornato con successo.' }))
                    .catch(() => res.status(500).send({ error: 'Errore nella query.' }));
            }
            //Solo password
            else {
                const query = `
                    UPDATE utente
                    SET password = $1
                    WHERE username = $2
                `;
                const values = [hashed, req.user];
                pool.query(query, values)
                    .then(() => res.send({ message: 'Password aggiornata con successo.' }))
                    .catch(() => res.status(500).send({ error: 'Errore nella query.' }));
            }
        });
    }
    //Solo mail
    else {
        const query = `
            UPDATE utente
            SET mail = $1
            WHERE username = $2
        `;
        const values = [params.mail, req.user];
        pool.query(query, values)
            .then(() => res.send({ message: 'Mail aggiornata con successo.' }))
            .catch(() => res.status(500).send({ error: 'Errore nella query.' }));
    }
}

//Endpoint POST/profilo/foto
const postFotoProfilo = (req, res) => {
    // #swagger.tags = ['Profilo Utente']
    // #swagger.summary = 'Aggiorna la foto del profilo dell\'utente'
    /* #swagger.requestBody = {
        required: true,
        content: {
            "multipart/form-data": {
                schema: {
                    type: "object",
                    properties: {
                        pimage: { type: "string", format: "binary" }
                    }
                }
            }
        }
    } */
    // #swagger.responses[200] = { description: 'OK' }
    // #swagger.responses[400] = { description: 'Bad Request' }
    // #swagger.responses[401] = { description: 'Unauthorized' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }

    if (!req.files || !req.files.pimage) {
        return res.status(400).send({ error: 'Nessuna foto ricevuta.' })
    }

    const file = req.files.pimage;

    if (file.mimetype !== 'image/jpeg') {
        return res.status(400).send({ error: 'Formato foto non valido. Solo JPG supportato.' })
    }

    if (file.size > 100000) { // 100KB
        return res.status(400).send({ error: 'Foto troppo grande. Massimo 100KB.' })
    }

    const filepath = __dirname + '/resources/' + req.user + '.jpg'

    file.mv(filepath, (err) => {
        if (err) {
            return res.status(500).send({ error: 'Errore durante il caricamento della foto.' })
        }

        const query = `
            UPDATE utente
            SET foto = $1
            WHERE username = $2
        `;
        const values = [`${req.user}.jpg`, req.user]

        pool.query(query, values)
            .then(() => res.send({ message: 'Foto profilo aggiornata con successo.' }))
            .catch(() => res.status(500).send({ error: 'Errore durante l\'aggiornamento nel database.' }))
    })
}

//Endpoint POST/admin/promozione
const postPromozione = (req, res) => {
    // #swagger.tags = ['Admin']
    // #swagger.summary = 'Promuove un utente a moderatore'
    /* #swagger.requestBody = {
        required: true,
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    properties: {
                        username: { type: "string" }
                    },
                    required: ["username"]
                }
            }
        }
    } */
    // #swagger.responses[200] = { description: 'OK' }
    // #swagger.responses[400] = { description: 'Bad Request' }
    // #swagger.responses[401] = { description: 'Unauthorized' }
    // #swagger.responses[404] = { description: 'Not Found' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }

    if (!req.body || !req.body.username)
        return res.status(400).send({ error: 'Parametri mancanti.' })

    const utenteDaPromuovere = req.body.username;

    // Verifica se l'utente autenticato è amministratore
    const checkAdminQuery = `
        SELECT 1 FROM amministratore WHERE username = $1
    `;
    pool.query(checkAdminQuery, [req.user])
        .then(result => {
            if (result.rowCount === 0) {
                return res.status(401).send({ error: 'Solo un amministratore può promuovere altri utenti.' })
            }

            // Verifica se l'utente da promuovere esiste
            const checkUserQuery = `
                SELECT 1 FROM utente WHERE username = $1
            `;
            pool.query(checkUserQuery, [utenteDaPromuovere])
                .then(userResult => {
                    if (userResult.rowCount === 0) {
                        return res.status(404).send({ error: 'Utente da promuovere non trovato.' })
                    }

                    // Inserisce solo se non è già moderatore
                    const insertModeratoreQuery = `
                        INSERT INTO moderatore (username, data_nomina, nominato_da)
                        SELECT v.username, v.data_nomina, v.nominato_da
                        FROM (
                            SELECT $1 AS username, CURRENT_TIMESTAMP AS data_nomina, $2 AS nominato_da
                        ) AS v
                    WHERE NOT EXISTS (
                    SELECT 1 FROM moderatore WHERE username = v.username
                    )
                    `;
                    pool.query(insertModeratoreQuery, [utenteDaPromuovere, req.user])
                        .then(result => {
                            if (result.rowCount === 0) {
                                return res.status(400).send({ error: 'Utente già moderatore.' })
                            }

                            return res.send({ message: `Utente ${utenteDaPromuovere} promosso a moderatore.` })
                        })
                        .catch(() => {
                            return res.status(500).send({ error: 'Errore durante la promozione.' })
                        })

                })
                .catch(() => {
                    return res.status(500).send({ error: 'Errore nella verifica dell\'utente.' })
                });

        })
        .catch(() => {
            return res.status(500).send({ error: 'Errore nella verifica dei permessi.' })
        })
}

//Endpoint DELETE/admin/promozione/:username
const deletePromozione = (req, res) => {
    // #swagger.tags = ['Admin']
    // #swagger.summary = 'Rimuove un moderatore'
    /* #swagger.parameters['username'] = {
        in: 'path',
        description: 'Username del moderatore da rimuovere',
        required: true,
        type: 'string'
    } */
    // #swagger.responses[200] = { description: 'OK' }
    // #swagger.responses[400] = { description: 'Bad Request' }
    // #swagger.responses[401] = { description: 'Unauthorized' }
    // #swagger.responses[404] = { description: 'Not Found' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }

    const moderatoreDaRimuovere = req.params.username;

    // Verifica se l'utente autenticato è amministratore
    const checkAdminQuery = `
        SELECT 1 FROM amministratore WHERE username = $1
    `;
    pool.query(checkAdminQuery, [req.user])
        .then(result => {
            if (result.rowCount === 0) {
                return res.status(401).send({ error: 'Solo un amministratore può rimuovere moderatori.' })
            }

            // Verifica se il moderatore da rimuovere esiste
            const checkUserQuery = `
                SELECT 1 FROM moderatore WHERE username = $1
            `;
            pool.query(checkUserQuery, [moderatoreDaRimuovere])
                .then(userResult => {
                    if (userResult.rowCount === 0) {
                        return res.status(404).send({ error: 'Moderatore da rimuovere non trovato.' })
                    }

                    // Rimuove il moderatore
                    const deleteModeratoreQuery = `
                        DELETE FROM moderatore WHERE username = $1
                    `;
                    pool.query(deleteModeratoreQuery, [moderatoreDaRimuovere])
                        .then(() => {
                            return res.send({ message: `Moderatore ${moderatoreDaRimuovere} rimosso con successo.` })
                        })
                        .catch(() => {
                            return res.status(500).send({ error: 'Errore durante la rimozione del moderatore.' })
                        })

                })
                .catch(() => {
                    return res.status(500).send({ error: 'Errore nella verifica del moderatore.' })
                })    
        })
}

//Endpoint GET/admin/moderatori
const getModeratori = (req, res) => {
    // #swagger.tags = ['Admin']
    // #swagger.summary = 'Ottieni la lista dei moderatori'
    // #swagger.responses[200] = { description: 'OK' }
    // #swagger.responses[401] = { description: 'Unauthorized' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }
    const checkAdminQuery = `
        SELECT 1 FROM amministratore WHERE username = $1
    `;
    pool.query(checkAdminQuery, [req.user])
        .then(result => {
            if (result.rowCount === 0) {
                return res.status(401).send({ error: 'Solo un amministratore può accedere a questa risorsa.' })
            }

            const query = `
                SELECT username, data_nomina, nominato_da
                FROM moderatore
                ORDER BY username ASC
            `;
            pool.query(query)
                .then(moderatoriResult => {
                    return res.send(moderatoriResult.rows)
                })
                .catch(() => {
                    return res.status(500).send({ error: 'Errore durante il recupero dei moderatori.' })
                });
        })
        .catch(() => {
            return res.status(500).send({ error: 'Errore nella verifica dei permessi.' })
        })
}

//Endpoint POST/follow/:username
const postFollow = (req, res) => {
    // #swagger.tags = ['Follow']
    // #swagger.summary = 'Segui un utente'
    /* #swagger.parameters['username'] = {
        in: 'path',
        description: 'Username dell\'utente da seguire',
        required: true,
        type: 'string'
    } */
    // #swagger.responses[200] = { description: 'OK' }
    // #swagger.responses[400] = { description: 'Bad Request' }
    // #swagger.responses[401] = { description: 'Unauthorized' }
    // #swagger.responses[404] = { description: 'Not Found' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }

    const utenteDaSeguire = req.params.username;

    if (req.user === utenteDaSeguire)
        return res.status(400).send({ error: 'Non puoi seguire te stesso.' })

    const checkUserQuery = `
        SELECT 1 FROM utente WHERE username = $1
    `;
    pool.query(checkUserQuery, [utenteDaSeguire])
        .then(result => {
            if (result.rowCount === 0) {
                return res.status(404).send({ error: 'Utente da seguire non trovato.' })
            }

            // Verifica se già segue l'utente
            const checkFollowQuery = `
                SELECT 1 FROM seguito WHERE username_follower = $1 AND username_followed = $2
            `;
            pool.query(checkFollowQuery, [req.user, utenteDaSeguire])
                .then(checkFollowResult => {
                    if (checkFollowResult.rowCount > 0) {
                        return res.status(400).send({ error: `Stai già seguendo ${utenteDaSeguire}.` })
                    }
                    const followQuery = `
                        INSERT INTO seguito (username_follower, username_followed)
                        VALUES ($1, $2)
                    `;
                    pool.query(followQuery, [req.user, utenteDaSeguire])
                        .then(() => {
                            const updateFollowedQuery = `
                                UPDATE utente
                                SET num_follower = num_follower + 1
                                WHERE username = $1
                            `;
                            pool.query(updateFollowedQuery, [utenteDaSeguire])
                                .then(() => {
                                    const updateFollowerQuery = `
                                        UPDATE utente
                                        SET num_followed = num_followed + 1
                                        WHERE username = $1
                                    `;
                                    pool.query(updateFollowerQuery, [req.user])
                                        .then(() => {
                                            return res.send({ message: `Ora segui ${utenteDaSeguire}.` });
                                        })
                                        .catch(() => {
                                            return res.status(500).send({ error: 'Errore durante l\'aggiornamento dei contatori.' })
                                        })
                                })
                                .catch(() => {
                                    return res.status(500).send({ error: 'Errore durante l\'aggiornamento dei contatori.' })
                                })
                        })
                        .catch(() => {
                            return res.status(500).send({ error: 'Errore durante il follow.' })
                        })
                })
                .catch(() => {
                    return res.status(500).send({ error: 'Errore durante il follow.' })
                })
        })
        .catch(() => {
            return res.status(500).send({ error: 'Errore nella verifica dell\'utente.' })
        })
}

// Endpoint DELETE/follow/:username
const deleteFollow = (req, res) => {
    // #swagger.tags = ['Follow']
    // #swagger.summary = 'Smetti di seguire un utente'
    /* #swagger.parameters['username'] = {
        in: 'path',
        description: 'Username dell\'utente da smettere di seguire',
        required: true,
        type: 'string'
    } */
    // #swagger.responses[200] = { description: 'OK' }
    // #swagger.responses[400] = { description: 'Bad Request' }
    // #swagger.responses[401] = { description: 'Unauthorized' }
    // #swagger.responses[404] = { description: 'Not Found' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }

    const utenteDaSeguire = req.params.username;

    if (req.user === utenteDaSeguire)
        return res.status(400).send({ error: 'Non puoi smettere di seguire te stesso.' })

    const checkUserQuery = `SELECT 1 FROM utente WHERE username = $1`;
    pool.query(checkUserQuery, [utenteDaSeguire])
        .then(result => {
            if (result.rowCount === 0) {
                return res.status(404).send({ error: 'Utente da smettere di seguire non trovato.' })
            }

            const checkFollowQuery = `
                SELECT 1 FROM seguito
                WHERE username_follower = $1 AND username_followed = $2
            `;
            pool.query(checkFollowQuery, [req.user, utenteDaSeguire])
                .then(result => {
                    if (result.rowCount === 0) {
                        return res.status(400).send({ error: `Non stai seguendo ${utenteDaSeguire}.` })
                    }

                    const unfollowQuery = `
                        DELETE FROM seguito
                        WHERE username_follower = $1 AND username_followed = $2
                    `;
                    pool.query(unfollowQuery, [req.user, utenteDaSeguire])
                        .then(() => {
                            const updateFollowedQuery = `
                                UPDATE utente
                                SET num_follower = num_follower - 1
                                WHERE username = $1
                            `;
                            pool.query(updateFollowedQuery, [utenteDaSeguire])
                                .then(() => {
                                    const updateFollowerQuery = `
                                        UPDATE utente
                                        SET num_followed = num_followed - 1
                                        WHERE username = $1
                                    `;
                                    pool.query(updateFollowerQuery, [req.user])
                                        .then(() => {
                                            return res.send({ message: `Non segui più ${utenteDaSeguire}.` })
                                        })
                                        .catch(() => {
                                            return res.status(500).send({ error: 'Errore durante l\'aggiornamento dei contatori.' })
                                        });
                                })
                                .catch(() => {
                                    return res.status(500).send({ error: 'Errore durante l\'aggiornamento dei contatori.' })
                                });
                        })
                        .catch(() => {
                            return res.status(500).send({ error: 'Errore durante lo smettere di seguire.' })
                        })
                })
                .catch(() => {
                    return res.status(500).send({ error: 'Errore durante la verifica della relazione di follow.' })
                });
        })
        .catch(() => {
            return res.status(500).send({ error: 'Errore nella verifica dell\'utente.' })
        })
}

//Endpoint GET/utente/search?query=string
const getSearchUtente = (req, res) => {
    // #swagger.tags = ['Utente']
    // #swagger.summary = 'Cerca utenti per username'
    /* #swagger.parameters['query'] = {
        in: 'query',
        description: 'Stringa di ricerca per username',
        type: 'string'
    } */
    // #swagger.responses[200] = { description: 'OK' }
    // #swagger.responses[400] = { description: 'Bad Request' }
    // #swagger.responses[401] = { description: 'Unauthorized' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }

    const query = req.query.query;
    if (!query || query.length < 1)
        return res.status(400).send({ error: 'Parametri mancanti.' })

    const searchQuery = `
        SELECT username, mail, num_follower, num_followed
        FROM utente
        WHERE username ILIKE $1 AND username != $2
        ORDER BY username ASC
        LIMIT 10
    `;
    const values = [`${query}%`, req.user]

    pool.query(searchQuery, values)
        .then(result => {
            return res.send(result.rows)
        })
        .catch(() => {
            return res.status(500).send({ error: 'Errore durante la ricerca.' })
        })
}

//Endpoint GET/followers
const getFollowers = (req, res) => {
    // #swagger.tags = ['Follow']
    // #swagger.summary = 'Ottieni la lista dei tuoi follower'
    // #swagger.responses[200] = { description: 'OK' }
    // #swagger.responses[401] = { description: 'Unauthorized' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }

    const username = req.user;

    const followersQuery = `
        SELECT u.username, u.mail
        FROM seguito s
        JOIN utente u ON s.username_follower = u.username
        WHERE s.username_followed = $1
        ORDER BY u.username ASC
    `;
    pool.query(followersQuery, [username])
        .then(followersResult => {
            return res.send(followersResult.rows);
        })
        .catch(() => {
            return res.status(500).send({ error: 'Errore durante il recupero dei follower.' })
        });
};

//Endpoint GET/followed
const getFollowed = (req, res) => {
    // #swagger.tags = ['Follow']
    // #swagger.summary = 'Ottieni la lista dei tuoi seguiti'
    // #swagger.responses[200] = { description: 'OK' }
    // #swagger.responses[401] = { description: 'Unauthorized' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }

    const username = req.user;

    const followedQuery = `
        SELECT u.username, u.mail
        FROM seguito s
        JOIN utente u ON s.username_followed = u.username
        WHERE s.username_follower = $1
        ORDER BY u.username ASC
    `;
    pool.query(followedQuery, [username])
        .then(followedResult => {
            return res.send(followedResult.rows);
        })
        .catch(() => {
            return res.status(500).send({ error: 'Errore durante il recupero dei seguiti.' })
        });
};

//Endpoint POST/post
const postPost = (req, res) => {
    // #swagger.tags = ['Post']
    // #swagger.summary = 'Crea un nuovo post'
    /* #swagger.requestBody = {
        required: true,
        content: {
            "multipart/form-data": {
                schema: {
                    type: "object",
                    properties: {
                        testo: { type: "string" },
                        immagine: { type: "string", format: "binary" }
                    }
                }
            }
        }
    } */
    // #swagger.responses[200] = { description: 'OK' }
    // #swagger.responses[400] = { description: 'Bad Request' }
    // #swagger.responses[401] = { description: 'Unauthorized' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }

    const testo = req.body.testo;
    const immagine = req.files ? req.files.immagine : undefined

    // Nessun contenuto
    if ((!testo || testo.trim() === '') && !immagine)
        return res.status(400).send({ error: 'Devi fornire un testo o un\'immagine.' })

    // Entrambi presenti
    if (testo && immagine)
        return res.status(400).send({ error: 'Puoi fornire solo un testo o un\'immagine, non entrambi.' })

    const tipo = immagine ? 'immagine' : 'testo'

    // Controlla se l'utente ha almeno 3 post moderati negli ultimi 30 giorni
    const checkModeratiQuery = `
        SELECT COUNT(*) AS moderati
        FROM post
        WHERE username = $1
          AND data_moderazione IS NOT NULL
          AND data_moderazione >= CURRENT_DATE - INTERVAL '30 days'
    `;

    return pool.query(checkModeratiQuery, [req.user])
        .then(result => {
            const count = parseInt(result.rows[0].moderati)
            if (count >= 3) {
                return res.status(400).send({ error: 'Hai raggiunto il limite di 3 post moderati negli ultimi 30 giorni. Non puoi creare nuovi post.' })
            }

            // Solo testo
            if (testo) {
                const query = `
                    INSERT INTO post (testo, immagine, type, data, num_like, username)
                    VALUES ($1, NULL, 'testo', CURRENT_TIMESTAMP, 0, $2)
                `;
                pool.query(query, [testo, req.user])
                    .then(() => res.send({ message: 'Post testuale creato con successo.' }))
                    .catch(() => res.status(500).send({ error: 'Errore durante l\'inserimento.' }))
            }

            // Solo immagine
            else {
                if (immagine.mimetype !== "image/jpeg")
                    return res.status(400).send({ error: 'Solo immagini JPG sono supportate.' })

                if (immagine.size > 100000)
                    return res.status(400).send({ error: 'Immagine troppo grande. Massimo 100KB.' })

                const uniqueId = crypto.randomBytes(8).toString('hex')
                const nomeFile = `post_${req.user}_${uniqueId}.jpg`
                const path = __dirname + '/resources/' + nomeFile

                immagine.mv(path, err => {
                    if (err)
                        return res.status(500).send({ error: 'Errore nel salvataggio dell\'immagine.' })

                    const query = `
                        INSERT INTO post (testo, immagine, type, data, num_like, username)
                        VALUES (NULL, $1, 'immagine', CURRENT_TIMESTAMP, 0, $2)
                    `;
                    pool.query(query, [nomeFile, req.user])
                        .then(() => res.send({ message: 'Post con immagine creato con successo.' }))
                        .catch(() => res.status(500).send({ error: 'Errore durante l\'inserimento del post.' }))
                });
            }
        })
        .catch(() => {
            return res.status(500).send({ error: 'Errore nel controllo dei post moderati.' })
        })
}

// Endpoint DELETE/post/:id_post
const deletePost = (req, res) => {
    // #swagger.tags = ['Post']
    // #swagger.summary = 'Elimina un post (solo autore)'
    /* #swagger.parameters['id_post'] = {
        in: 'path',
        description: 'ID del post da eliminare',
        required: true,
        type: 'integer'
    } */
    // #swagger.responses[200] = { description: 'Post eliminato con successo' }
    // #swagger.responses[400] = { description: 'ID post non valido' }
    // #swagger.responses[401] = { description: 'Non autorizzato' }
    // #swagger.responses[404] = { description: 'Post non trovato' }
    // #swagger.responses[500] = { description: 'Errore del server' }

    const idPost = parseInt(req.params.id_post)
    const username = req.user

    if (isNaN(idPost)) {
        return res.status(400).send({ error: 'ID post non valido.' })
    }

    const checkQuery = `
        SELECT username, immagine, mod_username, admin_username, data_moderazione
        FROM post
        WHERE id_post = $1
    `;

    pool.query(checkQuery, [idPost])
        .then(result => {
            if (result.rowCount === 0) {
                return res.status(404).send({ error: 'Post non trovato.' })
            }

            const post = result.rows[0];

            if (post.username !== username) {
                return res.status(401).send({ error: 'Non sei autorizzato a eliminare questo post.' })
            }

            if (post.mod_username !== null || post.admin_username !== null || post.data_moderazione !== null) {
                return res.status(400).send({ error: 'Non puoi eliminare un post che è stato moderato.' })
            }

            const deleteQuery = `
                DELETE FROM post
                WHERE id_post = $1
            `;

            pool.query(deleteQuery, [idPost])
                .then(() => {
                    if (post.immagine) {
                        const imagePath = path.join(__dirname, 'resources', post.immagine)
                        // eventuale rimozione file immagine
                    }
                    return res.send({ message: 'Post eliminato con successo.' })
                })
                .catch(() => {
                    return res.status(500).send({ error: 'Errore durante l\'eliminazione del post.' })
                });
        })
        .catch(() => {
            return res.status(500).send({ error: 'Errore durante il controllo del post.' })
        })
}

//Endpoint GET/bacheca
const getBacheca = (req, res) => {
    // #swagger.tags = ['Post']
    // #swagger.summary = 'Ottieni la bacheca degli utenti seguiti e dei propri post, impaginata dal post più recente'
    /* #swagger.parameters['page'] = {
        in: 'query',
        description: 'Numero della pagina (inizia da 1)',
        required: false,
        type: 'integer'
    } */
    // #swagger.responses[200] = { description: 'OK' }
    // #swagger.responses[401] = { description: 'Unauthorized' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }

    const username = req.user
    const page = Math.max(1, parseInt(req.query.page ?? 1))
    const limit = 2
    const offset = (page - 1) * limit

    const checkRoleQuery = `
        SELECT 'moderatore' AS ruolo FROM moderatore WHERE username = $1
        UNION
        SELECT 'amministratore' AS ruolo FROM amministratore WHERE username = $1
    `;

    pool.query(checkRoleQuery, [username])
        .then(roleResult => {
            const isModOrAdmin = roleResult.rowCount > 0;

            // Costruzione dinamica della SELECT
            let selectClause = `
                SELECT 
                    u.username, 
                    u.foto AS foto_profilo_utente, 
                    p.testo, 
                    p.immagine, 
                    p.num_like AS like,
                    EXISTS (
                        SELECT 1 
                        FROM flag f 
                        WHERE f.id_post = p.id_post AND f.username = $1
                    ) AS flaggato
            `;

            if (isModOrAdmin) {
                selectClause += `,
                    (p.mod_username IS NOT NULL OR p.admin_username IS NOT NULL) AS moderato
                `;
            }

            let bachecaQuery = `
                ${selectClause}
                FROM post p
                JOIN utente u ON p.username = u.username
                WHERE 
                    (p.username = $1 OR p.username IN (
                        SELECT username_followed FROM seguito WHERE username_follower = $1
                    ))
            `;

            if (!isModOrAdmin) {
                bachecaQuery += `
                    AND p.mod_username IS NULL
                    AND p.admin_username IS NULL
                    AND p.data_moderazione IS NULL
                `;
            }

            bachecaQuery += `
                ORDER BY p.data DESC
                LIMIT 2 OFFSET $2
            `;

            return pool.query(bachecaQuery, [username, offset])
        })
        .then(bachecaResult => {
            return res.send(bachecaResult.rows)
        })
        .catch(() => {
            return res.status(500).send({ error: 'Errore durante il recupero della bacheca.' })
        })
}

// Endpoint POST/like/:id_post
const postLike = (req, res) => {
    // #swagger.tags = ['Like']
    // #swagger.summary = 'Metti like a un post'
    /* #swagger.parameters['id_post'] = {
        in: 'path',
        description: 'ID del post a cui mettere like',
        required: true,
        type: 'integer'
    } */
    // #swagger.responses[200] = { description: 'OK' }
    // #swagger.responses[400] = { description: 'Bad Request' }
    // #swagger.responses[401] = { description: 'Unauthorized' }
    // #swagger.responses[404] = { description: 'Not Found' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }

    const idPost = parseInt(req.params.id_post)

    if (isNaN(idPost)) {
        return res.status(400).send({ error: 'ID post non valido.' })
    }

    // Verifica se il post esiste e se è stato moderato
    const checkPostQuery = `
        SELECT data_moderazione FROM post WHERE id_post = $1
    `
    pool.query(checkPostQuery, [idPost])
        .then(result => {
            if (result.rowCount === 0) {
                return res.status(404).send({ error: 'Post non trovato.' })
            }

            if (result.rows[0].data_moderazione !== null) {
                return res.status(400).send({ error: 'Il post è stato moderato.' })
            }

            // Verifica se l'utente ha già messo like
            const checkLikeQuery = `
                SELECT 1 FROM mi_piace WHERE id_post = $1 AND username = $2
            `;
            pool.query(checkLikeQuery, [idPost, req.user])
                .then(likeResult => {
                    if (likeResult.rowCount > 0) {
                        return res.status(400).send({ error: 'Hai già messo like a questo post.' })
                    }

                    // Inserisce il like
                    const insertLikeQuery = `
                        INSERT INTO mi_piace (id_post, username)
                        VALUES ($1, $2)
                    `;
                    pool.query(insertLikeQuery, [idPost, req.user])
                        .then(() => {
                            // Aggiorna il contatore
                            const updateLikeQuery = `
                                UPDATE post
                                SET num_like = num_like + 1
                                WHERE id_post = $1
                            `;
                            pool.query(updateLikeQuery, [idPost])
                                .then(() => {
                                    return res.send({ message: 'Like aggiunto con successo.' })
                                })
                                .catch(() => {
                                    return res.status(500).send({ error: 'Errore durante l\'aggiornamento dei like.' })
                                })
                        })
                        .catch(() => {
                            return res.status(500).send({ error: 'Errore durante l\'inserimento del like.' })
                        })
                })
                .catch(() => {
                    return res.status(500).send({ error: 'Errore durante il controllo del like.' })
                })
        })
        .catch(() => {
            return res.status(500).send({ error: 'Errore durante la verifica del post.' })
        })
}

// Endpoint DELETE/like/:id_post
const deleteLike = (req, res) => {
    // #swagger.tags = ['Like']
    // #swagger.summary = 'Rimuovi like da un post'
    /* #swagger.parameters['id_post'] = {
        in: 'path',
        description: 'ID del post da cui rimuovere il like',
        required: true,
        type: 'integer'
    } */
    // #swagger.responses[200] = { description: 'OK' }
    // #swagger.responses[400] = { description: 'Bad Request' }
    // #swagger.responses[401] = { description: 'Unauthorized' }
    // #swagger.responses[404] = { description: 'Not Found' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }

    const idPost = parseInt(req.params.id_post)

    if (isNaN(idPost)) {
        return res.status(400).send({ error: 'ID post non valido.' })
    }

    // Verifica se il post esiste e se è stato moderato
    const checkPostQuery = `
        SELECT data_moderazione FROM post WHERE id_post = $1
    `
    pool.query(checkPostQuery, [idPost])
        .then(result => {
            if (result.rowCount === 0) {
                return res.status(404).send({ error: 'Post non trovato.' })
            }

            if (result.rows[0].data_moderazione !== null) {
                return res.status(400).send({ error: 'Il post è stato moderato.' })
            }

            // Verifica se l'utente ha messo like
            const checkLikeQuery = `
                SELECT 1 FROM mi_piace WHERE id_post = $1 AND username = $2
            `;
            pool.query(checkLikeQuery, [idPost, req.user])
                .then(likeResult => {
                    if (likeResult.rowCount === 0) {
                        return res.status(400).send({ error: 'Non hai messo like a questo post.' })
                    }

                    // Rimuove il like
                    const deleteLikeQuery = `
                        DELETE FROM mi_piace WHERE id_post = $1 AND username = $2
                    `;
                    pool.query(deleteLikeQuery, [idPost, req.user])
                        .then(() => {
                            // Aggiorna il contatore
                            const updateLikeQuery = `
                                UPDATE post
                                SET num_like = num_like - 1
                                WHERE id_post = $1
                            `;
                            pool.query(updateLikeQuery, [idPost])
                                .then(() => {
                                    return res.send({ message: 'Like rimosso con successo.' })
                                })
                                .catch(() => {
                                    return res.status(500).send({ error: 'Errore durante l\'aggiornamento dei like.' })
                                })
                        })
                        .catch(() => {
                            return res.status(500).send({ error: 'Errore durante la rimozione del like.' })
                        })
                })
                .catch(() => {
                    return res.status(500).send({ error: 'Errore durante il controllo del like.' })
                })
        })
        .catch(() => {
            return res.status(500).send({ error: 'Errore durante la verifica del post.' })
        })
}

// Endpoint POST/flag/:id_post
const postFlag = (req, res) => {
    // #swagger.tags = ['Flag']
    // #swagger.summary = 'Segnala un post come inappropriato (flag)'
    /* #swagger.parameters['id_post'] = {
        in: 'path',
        description: 'ID del post da segnalare',
        required: true,
        type: 'integer'
    } */
    // #swagger.responses[200] = { description: 'OK' }
    // #swagger.responses[400] = { description: 'Bad Request' }
    // #swagger.responses[401] = { description: 'Unauthorized' }
    // #swagger.responses[404] = { description: 'Not Found' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }

    const idPost = parseInt(req.params.id_post)

    if (isNaN(idPost)) {
        return res.status(400).send({ error: 'ID post non valido.' })
    }

    const checkPostQuery = `
        SELECT username, data_moderazione FROM post WHERE id_post = $1
    `;
    pool.query(checkPostQuery, [idPost])
        .then(result => {
            if (result.rowCount === 0) {
                return res.status(404).send({ error: 'Post non trovato.' })
            }

            const autore = result.rows[0].username
            const dataModerazione = result.rows[0].data_moderazione

            if (autore === req.user) {
                return res.status(400).send({ error: 'Non puoi segnalare un post creato da te.' })
            }

            if (dataModerazione !== null) {
                return res.status(400).send({ error: 'Il post è già stato moderato.' })
            }

            // Verifica se l'utente ha già segnalato
            const checkFlagQuery = `
                SELECT 1 FROM flag WHERE id_post = $1 AND username = $2
            `;
            pool.query(checkFlagQuery, [idPost, req.user])
                .then(flagUserResult => {
                    if (flagUserResult.rowCount > 0) {
                        return res.status(400).send({ error: 'Hai già segnalato questo post.' })
                    }

                    const insertFlagQuery = `
                        INSERT INTO flag (id_post, username)
                        VALUES ($1, $2)
                    `;
                    pool.query(insertFlagQuery, [idPost, req.user])
                        .then(() => {
                            return res.send({ message: 'Post segnalato con successo.' })
                        })
                        .catch(() => {
                            return res.status(500).send({ error: 'Errore durante l\'inserimento del flag.' })
                        });
                })
                .catch(() => {
                    return res.status(500).send({ error: 'Errore durante il controllo del flag.' })
                });
        })
        .catch(() => {
            return res.status(500).send({ error: 'Errore durante la verifica del post.' })
        })
}

// Endpoint DELETE/flag/:id_post
const deleteFlag = (req, res) => {
    // #swagger.tags = ['Flag']
    // #swagger.summary = 'Rimuovi flag (segnalazione) da un post'
    /* #swagger.parameters['id_post'] = {
        in: 'path',
        description: 'ID del post da cui rimuovere il flag',
        required: true,
        type: 'integer'
    } */
    // #swagger.responses[200] = { description: 'OK' }
    // #swagger.responses[400] = { description: 'Bad Request' }
    // #swagger.responses[401] = { description: 'Unauthorized' }
    // #swagger.responses[404] = { description: 'Not Found' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }

    const idPost = parseInt(req.params.id_post)

    if (isNaN(idPost)) {
        return res.status(400).send({ error: 'ID post non valido.' })
    }

    // Verifica se il post esiste e se è già stato moderato
    const checkPostQuery = `SELECT data_moderazione FROM post WHERE id_post = $1`;
    pool.query(checkPostQuery, [idPost])
        .then(result => {
            if (result.rowCount === 0) {
                return res.status(404).send({ error: 'Post non trovato.' })
            }

            if (result.rows[0].data_moderazione !== null) {
                return res.status(400).send({ error: 'Il post è già stato moderato.' })
            }

            // Verifica se l'utente ha effettivamente segnalato il post
            const checkFlagQuery = `
                SELECT 1 FROM flag WHERE id_post = $1 AND username = $2
            `;
            pool.query(checkFlagQuery, [idPost, req.user])
                .then(flagResult => {
                    if (flagResult.rowCount === 0) {
                        return res.status(400).send({ error: 'Non hai segnalato questo post.' })
                    }

                    // Rimuove la segnalazione
                    const deleteFlagQuery = `
                        DELETE FROM flag WHERE id_post = $1 AND username = $2
                    `;
                    pool.query(deleteFlagQuery, [idPost, req.user])
                        .then(() => {
                            return res.send({ message: 'Flag rimosso con successo.' })
                        })
                        .catch(() => {
                            return res.status(500).send({ error: 'Errore durante la rimozione del flag.' })
                        });
                })
                .catch(() => {
                    return res.status(500).send({ error: 'Errore durante il controllo del flag.' })
                });
        })
        .catch(() => {
            return res.status(500).send({ error: 'Errore durante la verifica del post.' })
        })
}

//Endpoint GET/moderazione/flag
const getPostFlaggati = (req, res) => {
    // #swagger.tags = ['Moderazione']
    // #swagger.summary = 'Lista dei post flaggati ancora da moderare'
    // #swagger.responses[200] = { description: 'OK' }
    // #swagger.responses[403] = { description: 'Forbidden' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }

    const username = req.user;

    const checkRoleQuery = `
        SELECT 1 FROM moderatore WHERE username = $1
        UNION
        SELECT 1 FROM amministratore WHERE username = $1
    `;

    pool.query(checkRoleQuery, [username])
        .then(roleResult => {
            if (roleResult.rowCount === 0) {
                return res.status(403).send({ error: 'Accesso riservato a moderatori o amministratori.' })
            }

            const query = `
            SELECT p.id_post, p.testo, p.immagine, p.data, p.username AS autore,
            COUNT(f.id_post) AS num_flag
            FROM post p
            JOIN flag f ON p.id_post = f.id_post
            WHERE p.mod_username IS NULL 
                AND p.admin_username IS NULL 
                AND p.data_moderazione IS NULL
            GROUP BY p.id_post, p.testo, p.immagine, p.data, p.username
            ORDER BY num_flag DESC;
            `;

            pool.query(query)
                .then(result => res.send(result.rows))
                .catch(() => res.status(500).send({ error: 'Errore nel recupero dei post flaggati.' }))
        })
        .catch(() => res.status(500).send({ error: 'Errore nella verifica dei permessi.' }))
}

//Endpoint PATCH/moderazione/:id_post
const patchModerazioneFlag = (req, res) => {
    // #swagger.tags = ['Moderazione']
    // #swagger.summary = 'Modera un post flaggato'
    /* #swagger.parameters['id_post'] = {
        in: 'path',
        description: 'ID del post da moderare',
        required: true,
        type: 'integer'
    } */
    // #swagger.responses[200] = { description: 'OK' }
    // #swagger.responses[400] = { description: 'Bad Request' }
    // #swagger.responses[401] = { description: 'Unauthorized' }
    // #swagger.responses[403] = { description: 'Forbidden' }
    // #swagger.responses[404] = { description: 'Not Found' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }

    const idPost = parseInt(req.params.id_post)
    const username = req.user

    if (isNaN(idPost)) {
        return res.status(400).send({ error: 'ID post non valido.' })
    }

    const checkRoleQuery = `
        SELECT 'moderatore' AS ruolo FROM moderatore WHERE username = $1
        UNION
        SELECT 'amministratore' AS ruolo FROM amministratore WHERE username = $1
    `;

    pool.query(checkRoleQuery, [username])
        .then(roleResult => {
            if (roleResult.rowCount === 0) {
                return res.status(403).send({ error: 'Accesso riservato a moderatori o amministratori.' })
            }

            const ruolo = roleResult.rows[0].ruolo;

            const checkPostQuery = `
                SELECT * FROM post WHERE id_post = $1
            `;
            pool.query(checkPostQuery, [idPost])
                .then(postResult => {
                    if (postResult.rowCount === 0) {
                        return res.status(404).send({ error: 'Post non trovato.' })
                    }

                    const post = postResult.rows[0];
                    if (post.mod_username || post.admin_username || post.data_moderazione) {
                        return res.status(400).send({ error: 'Post già moderato.' })
                    }

                    // Verifica se il post è stato flaggato
                    const checkFlagQuery = `SELECT 1 FROM flag WHERE id_post = $1`;
                    pool.query(checkFlagQuery, [idPost])
                        .then(flagResult => {
                            if (flagResult.rowCount === 0) {
                                return res.status(400).send({ error: 'Non è possibile moderare un post non flaggato.' })
                            }

                            // Post flaggato: procedi con la moderazione
                            const updateQuery = `
                                UPDATE post
                                SET data_moderazione = CURRENT_DATE,
                                    ${ruolo === 'moderatore' ? 'mod_username' : 'admin_username'} = $2
                                WHERE id_post = $1
                            `;

                            pool.query(updateQuery, [idPost, username])
                                .then(() => res.send({ message: 'Post moderato con successo.' }))
                                .catch(() => res.status(500).send({ error: 'Errore durante la moderazione del post.' }))
                        })
                        .catch(() => res.status(500).send({ error: 'Errore durante la verifica dei flag.' }))
                })
                .catch(() => res.status(500).send({ error: 'Errore durante la verifica del post.' }))
        })
        .catch(() => res.status(500).send({ error: 'Errore nella verifica dei permessi.' }))
}

//Endpoint GET/moderazione/post
const getPostModerati = (req, res) => {
    // #swagger.tags = ['Moderazione']
    // #swagger.summary = 'Lista dei post moderati'
    // #swagger.responses[200] = { description: 'OK' }
    // #swagger.responses[401] = { description: 'Unauthorized' }
    // #swagger.responses[403] = { description: 'Forbidden' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }

    const username = req.user;

    const checkRoleQuery = `
        SELECT 1 FROM moderatore WHERE username = $1
        UNION
        SELECT 1 FROM amministratore WHERE username = $1
    `;

    pool.query(checkRoleQuery, [username])
        .then(roleResult => {
            if (roleResult.rowCount === 0) {
                return res.status(403).send({ error: 'Accesso riservato a moderatori o amministratori.' })
            }

            const query = `
                SELECT p.id_post, p.testo, p.immagine, TO_CHAR(p.data, 'YYYY-MM-DD') AS data, p.username AS autore,
                p.mod_username, p.admin_username, TO_CHAR(p.data_moderazione, 'YYYY-MM-DD') AS data_moderazione
                FROM post p
                WHERE p.data_moderazione IS NOT NULL
                ORDER BY p.data_moderazione DESC;
            `;

            pool.query(query)
                .then(result => res.send(result.rows))
                .catch(() => res.status(500).send({ error: 'Errore nel recupero dei post moderati.' }))
        })
        .catch(() => res.status(500).send({ error: 'Errore nella verifica dei permessi.' }))
}

//Endpoint GET/utente/:username
const getProfiloUtente = (req, res) => {
    // #swagger.tags = ['Utente']
    // #swagger.summary = 'Ottieni i dati e i post di un utente'
    /* #swagger.parameters['username'] = {
        in: 'path',
        description: 'Username dell\'utente',
        type: 'string'
    } */
    // #swagger.responses[200] = { description: 'OK' }
    // #swagger.responses[400] = { description: 'Bad Request' }
    // #swagger.responses[401] = { description: 'Unauthorized' }
    // #swagger.responses[404] = { description: 'Not Found' }
    // #swagger.responses[500] = { description: 'Internal Server Error' }

    const username = req.params.username
    if (!username || username.trim() === "") {
    return res.status(400).send({ error: 'Parametro username mancante o non valido.' });
    }

    const utenteQuery = `
        SELECT username, mail, foto, num_follower, num_followed
        FROM utente
        WHERE username = $1
    `;

    const postQuery = `
        SELECT id_post, testo, immagine, num_like, data
        FROM post
        WHERE username = $1
          AND mod_username IS NULL
          AND admin_username IS NULL
          AND data_moderazione IS NULL
        ORDER BY data DESC
    `;

    pool.query(utenteQuery, [username])
        .then(userResult => {
            if (userResult.rowCount === 0) {
                return res.status(404).send({ error: 'Utente non trovato.' })
            }

            const user = userResult.rows[0]

            pool.query(postQuery, [username])
                .then(postResult => {
                    return res.send({
                        username: user.username,
                        mail: user.mail,
                        foto: user.foto,
                        num_follower: user.num_follower,
                        num_followed: user.num_followed,
                        post: postResult.rows
                    })
                })
                .catch(() => {
                    return res.status(500).send({ error: 'Errore durante il recupero dei post dell\'utente.' })
                })
        })
        .catch(() => {
            return res.status(500).send({ error: 'Errore durante il recupero dell\'utente.' })
        })
}



module.exports = function(app){
    //Autenticazione
    app.post('/registrazione', postRegistrazione) //pubblica, non auth
    app.post('/login', postLogin) //pubblica, non auth
    app.post('/logout', auth, postLogout) //privata, auth

    //Profilo Utente
    app.patch('/profilo', auth, patchProfilo) //privata, auth
    app.post('/profilo/foto', auth, postFotoProfilo) //privata, auth

    //Utente
    app.get('/utente/search', auth, getSearchUtente) //privata, auth
    app.get('/utente/:username', auth, getProfiloUtente) //privata, auth

    //Admin
    app.post('/admin/promozione', auth, postPromozione) //privata, auth
    app.delete('/admin/promozione/:username', auth, deletePromozione) //privata, auth
    app.get('/admin/moderatori', auth, getModeratori) //privata, auth

    //Follow e unfollow
    app.post('/follow/:username', auth, postFollow) //privata, auth
    app.delete('/follow/:username', auth, deleteFollow) //privata, auth
    app.get('/followers', auth, getFollowers) //privata, auth
    app.get('/followed', auth, getFollowed) //privata, auth

    //Post
    app.post('/post', auth, postPost) //privata, auth
    app.delete('/post/:id_post', auth, deletePost) //privata, auth
    app.get('/bacheca', auth, getBacheca) //privata, auth

    //Like
    app.post('/like/:id_post', auth, postLike) //privata, auth
    app.delete('/like/:id_post', auth, deleteLike) //privata, 

    //Flag
    app.post('/flag/:id_post', auth, postFlag) //privata, auth
    app.delete('/flag/:id_post', auth, deleteFlag) //privata, auth

    //Moderazione
    app.get('/moderazione/flag', auth, getPostFlaggati) //privata, auth
    app.patch('/moderazione/flag/:id_post', auth, patchModerazioneFlag) //privata, auth
    app.get('/moderazione/post', auth, getPostModerati) //privata, auth
}