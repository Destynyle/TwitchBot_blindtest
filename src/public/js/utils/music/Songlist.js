// Singleton, we want only one songlist
let isSongActive = false;
let firstResponseTime = null;
let validResponses = new Set(); // Pour éviter les doublons
let responseTimeout = null;
class Songlist {
    static instance = null;

    constructor() {
        this.songlist = [];
        this.threshold = 0.8;
        this.currentSong = -1;
        this.isPlaying = false;
        this.playersWhoAnswered = new Map(); // Map pour suivre les réponses et les timestamps
        this.firstArtistTime = null; // Timestamp de la première réponse artiste
        this.firstTitleTime = null;  // Timestamp de la première réponse titre
        this.penaltyCount = 0;       // Compteur pour le malus
    }

    static getInstance() {
        if (Songlist.instance === null) Songlist.instance = new Songlist();
        return Songlist.instance;
    }

    isGameStrated() {
        return this.isPlaying;
    }

    stratGame() {
        this.isPlaying = true;
    }

    stopGame() {
        this.isPlaying = false;
    }

    updateServerSongList() {
        $.ajax({
            type: "POST",
            url: "/api/songlist",
            dataType: 'json',
            contentType: 'application/json',
            data: JSON.stringify(this.songlist)
        });
    }

    removeSong(pIndex) {
        this.songlist.splice(pIndex, 1);

        this.updateServerSongList();
    }

    addSong(pArtiste, pTitle, pPenalty, pPoints) {
        this.songlist.push({
            isAlreadyPlayed: false,
            artist: pArtiste,
            isArtistFound: false,
            title: pTitle,
            isTitleFound: false,
            penalty: pPenalty,
            ispenaltyFound: false,
            points: pPoints,
            status: SongStatus.ToDo
        });

        this.updateServerSongList();
    }

    setSonglist(pSonglist) {
        this.songlist = pSonglist;
    }

    getSonglist() {
        return this.songlist;
    }

    setCurrentSong(pCurrentSongIndex) {
        try {
            const index = parseInt(pCurrentSongIndex);
            if (isNaN(index) || index < 0 || index >= this.songlist.length) {
                throw new Error(`Index de chanson invalide : ${pCurrentSongIndex}`);
            }

            this.currentSong = index;
            const song = this.songlist[this.currentSong];
            song.isAlreadyPlayed = true;
            song.isArtistFound = false;
            song.isTitleFound = false;
            song.ispenaltyFound = false;
            this.playersWhoAnswered.clear();
            this.firstArtistTime = null;
            this.firstTitleTime = null;
            this.penaltyCount = 0;
            this.isPlaying = true;
            this.updateServerSongList();

            // Message envoyé via Client
            const penaltyMessage = song.penalty ? ` Attention, un malus de ${song.points} points est en jeu !` : '';
            Client.getInstance().sendMessage(`🔔 Une nouvelle manche est en cours, à vos marques, prêt, écrivez !!${penaltyMessage}`);
        } catch (error) {
            console.error("Erreur dans setCurrentSong :", error);
            toastMessage.sendError(`Erreur lors du démarrage de la manche : ${error.message}`);
        }
    }


    stopCurrentSong() {
        this.isPlaying = false;
        this.updateServerSongList();
    }

    getCurrentSong() {
        return this.songlist[this.currentSong];
    }

    buildCheckResponse(pResponse, pFound, pSolution, pPoints) {
        pResponse.isOk = true;
        pResponse.found = pFound;
        pResponse.solution = pSolution;
        pResponse.points = pPoints;
        return pResponse;
    }

    checkSong(pMessage, username) {
        var response = {
            isOk: false,
            isAlreadyFound: false,
            isComplete: false
        };

        var song = this.songlist[this.currentSong];
        if (!this.isPlaying || song === undefined) return response;

        const now = Date.now();
        const similarityArtist = stringSimilarity.compareTwoStrings(pMessage.toLowerCase(), song.artist.toLowerCase());
        const similarityTitle = stringSimilarity.compareTwoStrings(pMessage.toLowerCase(), song.title.toLowerCase());
        const similarityPenalty = song.penalty ? stringSimilarity.compareTwoStrings(pMessage.toLowerCase(), song.penalty.toLowerCase()) : 0;

        // Vérifie la pénalité (active toute la manche)
        if (similarityPenalty > this.threshold && !this.playersWhoAnswered.has(`${username}:penalty`)) {
            this.playersWhoAnswered.set(`${username}:penalty`, now);
            this.penaltyCount++;
            const penaltyPoints = -Math.round(song.points * Math.pow(1.5, this.penaltyCount - 1));
            song.ispenaltyFound = true;
            return this.buildCheckResponse(response, 'penalty', song.penalty, penaltyPoints);
        }

        // Vérifie l’artiste
        if (similarityArtist > this.threshold && !this.playersWhoAnswered.has(`${username}:artist`)) {
            this.playersWhoAnswered.set(`${username}:artist`, now);
            if (!this.firstArtistTime) this.firstArtistTime = now;
            song.isArtistFound = true;

            const timeElapsed = (now - this.firstArtistTime) / 1000; // En secondes
            let points;
            if (timeElapsed === 0) {
                points = song.points; // 100% pour le premier
            } else if (timeElapsed <= 2) {
                points = Math.round((2 / 3) * song.points); // 2/3 des points
            } else if (timeElapsed <= 6) {
                points = Math.round((1 / 3) * song.points); // 1/3 des points
            } else {
                points = 0; // Plus de points après 6 secondes
            }
            response = this.buildCheckResponse(response, 'artist', song.artist, points);
        }

        // Vérifie le titre
        if (similarityTitle > this.threshold && !this.playersWhoAnswered.has(`${username}:title`)) {
            this.playersWhoAnswered.set(`${username}:title`, now);
            if (!this.firstTitleTime) this.firstTitleTime = now;
            song.isTitleFound = true;

            const timeElapsed = (now - this.firstTitleTime) / 1000; // En secondes
            let points;
            if (timeElapsed === 0) {
                points = song.points; // 100% pour le premier
            } else if (timeElapsed <= 2) {
                points = Math.round((2 / 3) * song.points); // 2/3 des points
            } else if (timeElapsed <= 6) {
                points = Math.round((1 / 3) * song.points); // 1/3 des points
            } else {
                points = 0; // Plus de points après 6 secondes
            }
            response = this.buildCheckResponse(response, 'title', song.title, points);
        }

        // Vérifie si artiste ET titre sont trouvés pour programmer la fin
        if (song.isArtistFound && song.isTitleFound && !response.isComplete) {
            setTimeout(() => this.stopCurrentSong(), 6000); // 6 secondes après
            response.isComplete = true;
        }

        return response;
    }

}