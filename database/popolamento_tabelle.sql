INSERT INTO Utente VALUES
('giulia', 'giulia@email.com', '043bf1d20e3485769d282d0066794af02518d415b39c904667e1ff7445ef47df8c6d8deb4255aca57d0901b8e305151d733ac9e13f9600dbbe0a05bb5b280809.c96906a4a6c125640c1ad70cef35fd4f', 5, 2, NULL),
('marco', 'marco@email.com', '79d1680e4c4ba17002d30daab7025bab54975cfe6390ca8fdfc7c56cfd4c41559e1992b6d29f0e1b268cce7b9992274e931ea188f9d60bab16c8d9066e9ae342.111cd5e5151656b84c96fb4be63581ff', 2, 2, NULL),
('elena', 'elena@email.com', '05b60c8c352093920d69a5c58c6cbd3ec4fc440641957b4c30fd154b6487198f78fab31520edcee452666700871550cb7e827718539f40e8fc33cb46dbf1e65e.e0e97d3be8e8ef46c21d2e8ebd440cb1', 2, 2, NULL),
('luca', 'luca@email.com', '70b0f66202d756199e341b90bcaf13845473fcdc85baa29e734c62dd5b078779c033438753d007c3fd5604d7dbe3dab96c81c867bac0774c32b1b937d24e48b6.135104d390d0d3a376db9bef2b6374d7', 1, 0, NULL),
('sara', 'sara@email.com', 'b6d2401507f72e8493db4a28a58ee167cb4e062505674d3e4e8eae37ec5204a23616ffcbb9a3a109e5f6364d389c7987856c70c4fdd9263c96cb84d6cdda84f3.b94f9e6b26c7cc54e5ec6a5aa595703c', 0, 0, NULL),
('andrea', 'andrea@email.com', 'cb9ba1ea051abfa637285f4de1a964f07c952be4b3feabfa61d3298bf0113f5372866f9107a81b6649bccb1f1db6246868605baa711048213228396373018ffa.6c7d190cb2a86b2b06b55a8bbf0f8ce8', 0, 1, NULL),
('francesca', 'francesca@email.com', '8e972fc28a2436f9dc58d7537c2c3cd70112e8fb0ca997e5ff3e16e9932123e66b596b6e83caa87ca3b57ad3642eb78b2bbb3e4761b7a1dea87a3eb048d83273.a944e7593acf3aeee50c6bd28d48e694', 0, 2, NULL),
('davide', 'davide@email.com', '8f0000d0958f06fed1ebee35b5e19f50cc5cdb3c59050fdf4a7074f8edc5a827c6d28a64aab2908c26140b3d487506a3df54afa27b31b11fc4e3a8a651787ea9.4b7f8d40dd175b5e9615832e424a6500', 0, 1, NULL);

INSERT INTO Login VALUES
('sessione_1', '2025-05-25 10:00:00.183546', '2025-05-25 10:01:10.274832', 'giulia'),
('sessione_2', '2025-05-25 11:00:00.462718', '2025-05-25 12:12:12.019364', 'marco');

INSERT INTO Seguito VALUES
('giulia', 'marco'),
('marco', 'giulia'),
('giulia', 'elena'),
('elena', 'giulia'),
('marco', 'elena'),
('elena', 'luca'),
('andrea', 'giulia'),
('francesca', 'marco'),
('francesca', 'giulia'),
('davide', 'giulia');

INSERT INTO Amministratore VALUES ('giulia');

INSERT INTO Moderatore VALUES
('marco', '2025-01-10', 'giulia'),
('elena', '2025-02-15', 'giulia');

INSERT INTO Post VALUES
(101, 2, NULL, 'Buongiorno a tutti!', 'testo', '2025-05-21 09:30:00.910375', 'luca', NULL, NULL, NULL),
(102, 2, 'post_elena_132n3kal3ia1j3ns.jpg', NULL, 'immagine', '2025-05-21 18:45:00.361534', 'elena', NULL, NULL, NULL),
(103, 1, NULL, 'Qualcuno ha visto il film nuovo?', 'testo', '2025-05-22 21:00:00.816452', 'marco', NULL, NULL, NULL),
(104, 2, 'post_sara_sjq016dg3jabc4jk.jpg', NULL, 'immagine', '2025-05-23 12:15:00.918264', 'sara', NULL, NULL, NULL),
(105, 0, NULL, 'Spam post da rimuovere', 'testo', '2025-05-22 10:00:00.192846', 'andrea', 'marco', NULL, '2025-05-23'),
(106, 0, 'post_francesca_38sjh73hdka019js.jpg', NULL, 'immagine', '2025-05-22 14:00:00.910264', 'francesca', 'elena', NULL, '2025-05-23');

INSERT INTO Mi_piace VALUES
(101, 'giulia'),
(101, 'elena'),
(102, 'marco'),
(102, 'giulia'),
(103, 'elena'),
(104, 'giulia'),
(105, 'marco');

INSERT INTO Flag VALUES
(105, 'giulia'),
(106, 'elena'),
(106, 'giulia'),
(106, 'marco');
