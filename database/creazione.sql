CREATE TABLE Utente (
    username VARCHAR(30) PRIMARY KEY,
    mail VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    num_follower INT NOT NULL,
    num_followed INT NOT NULL,
    foto TEXT
);

CREATE TABLE Login (
    id_sessione TEXT PRIMARY KEY,
    inizio_sessione TIMESTAMP NOT NULL,
    fine_sessione TIMESTAMP,
    username VARCHAR(30) NOT NULL,
    FOREIGN KEY (username) REFERENCES Utente(username)
);

CREATE TABLE Seguito (
    username_follower VARCHAR(30),
    username_followed VARCHAR(30),
    PRIMARY KEY (username_follower, username_followed),
    FOREIGN KEY (username_follower) REFERENCES Utente(username),
    FOREIGN KEY (username_followed) REFERENCES Utente(username)
);

CREATE TABLE Amministratore (
    username VARCHAR(30) PRIMARY KEY,
    FOREIGN KEY (username) REFERENCES Utente(username)
);

CREATE TABLE Moderatore (
    username VARCHAR(30) PRIMARY KEY,
    data_nomina DATE NOT NULL,
    nominato_da VARCHAR(30),
    FOREIGN KEY (username) REFERENCES Utente(username),
    FOREIGN KEY (nominato_da) REFERENCES Amministratore(username)
);

CREATE TABLE Post (
    id_post SERIAL PRIMARY KEY,
    num_like INT NOT NULL,
    immagine TEXT,
    testo TEXT,
    type VARCHAR(10) NOT NULL,
    data TIMESTAMP NOT NULL,
    username VARCHAR(30) NOT NULL,
    mod_username VARCHAR(30),
    admin_username VARCHAR(30),
    data_moderazione DATE,
    FOREIGN KEY (username) REFERENCES Utente(username),
    FOREIGN KEY (mod_username) REFERENCES Moderatore(username),
    FOREIGN KEY (admin_username) REFERENCES Amministratore(username)
);

CREATE TABLE Mi_piace (
    id_post INT,
    username VARCHAR(30),
    PRIMARY KEY (id_post, username),
    FOREIGN KEY (id_post) REFERENCES Post(id_post),
    FOREIGN KEY (username) REFERENCES Utente(username)
);

CREATE TABLE Flag (
    id_post INT,
    username VARCHAR(30),
    PRIMARY KEY (id_post, username),
    FOREIGN KEY (id_post) REFERENCES Post(id_post),
    FOREIGN KEY (username) REFERENCES Utente(username)
);
