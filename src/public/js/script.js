

function onClientStrarted() {

    $.ajax({
        type: "GET",
        url: "/api/songlist",
        success: function (response) {
            try {
                Songlist.getInstance().setSonglist(response);
                refreshSongList();
            } catch (error) {
                toastMessage.sendInfo('Impossible de récupérer la précédente songlist.');
            }
        }
    });

    $.ajax({
        type: "GET",
        url: "/api/scoreboard",
        success: function (response) {
            try {
                Scoreboard.getInstance().setScoreboard(response);
                refreshScoreboard();
            } catch (error) {
                toastMessage.sendInfo('Impossible de récupérer le précédent tableau des scores.');
            }
        }
    });
}

function refreshSongList() {
    const songlist = Songlist.getInstance().getSonglist();
    var tabSonglist = $('div#songlist table tbody');
    tabSonglist.empty();

    console.log("Mise à jour de la liste des chansons, nombre d'éléments :", songlist.length);

    songlist.forEach((song, index) => {
        var elem = `
            <tr class="${song.isAlreadyPlayed ? 'done' : ''}">
                <td>${index + 1}</td>
                <td>${song.artist}</td>
                <td>${song.title}</td>
                <td>${song.penalty}</td>
                <td>${song.points}</td>
                <td><img class="icon play${song.isAlreadyPlayed ? ' recording' : ''}" src="resources/icons/${song.isAlreadyPlayed ? 'recording' : 'play'}.svg" title="GO" alt="start song" data-index="${index}"></td>
                <td><img class="icon delete" src="resources/icons/delete.svg" title="supprimer" alt="delete song" data-index="${index}"></td>
            </tr>
        `;
        tabSonglist.append(elem);
    });

    const playButtons = $('img.play');
    console.log("Nombre de boutons play trouvés :", playButtons.length);

    playButtons.off('click').on('click', function () {
        const index = this.dataset.index;
        console.log(`Clic sur play pour l'index : ${index}`);
        try {
            Songlist.getInstance().setCurrentSong(index);
            toastMessage.sendInfo('Nouvelle musique en cours.');
            this.parentElement.parentElement.classList.add('done');
            console.log("Classe 'done' ajoutée à la ligne :", this.parentElement.parentElement);

            // Réinitialise tous les boutons "recording" à "play"
            $('.recording').each(function () {
                console.log("Réinitialisation d’un bouton recording :", this);
                this.classList.remove('recording');
                this.src = 'resources/icons/play.svg';
            });

            // Applique recording au bouton cliqué
            this.classList.add('recording');
            this.src = 'resources/icons/recording.svg';
            console.log("Bouton après changement - Classe :", this.className, "Src :", this.src);

            // Force un rafraîchissement visuel
            this.style.display = 'none';
            this.offsetHeight; // Déclenche un reflow
            this.style.display = '';
        } catch (error) {
            console.error("Erreur lors du clic sur play :", error);
            toastMessage.sendError("Erreur lors du démarrage de la musique.");
        }
    });

    $('img.delete').on('click', function () {
        Songlist.getInstance().removeSong(this.dataset.index);
        toastMessage.sendInfo('La musique a bien été supprimée.');
        refreshSongList();
    });
}


function refreshScoreboard() {
    const scores = Scoreboard.getInstance().getScores();

    var tabScore = $('div#scores table tbody');
    tabScore.empty();

    scores.forEach(score => {
        var elem = `
            <tr>
                <td>${score.user}</td>
                <td>${score.points}</td>
                <td><img class="icon minus" src="resources/icons/minus.svg" title="-1 points" alt="remove point" data-user="${score.user}"></td>
                <td><img class="icon add" src="resources/icons/add.svg" title="+1 points" alt="add point" data-user="${score.user}"></td>
            </tr>
        `;
        tabScore.append(elem);
    });

    $('img.minus').on('click', function () {
        Scoreboard.getInstance().score(this.dataset.user, -1);
        refreshScoreboard();
    });

    $('img.add').on('click', function () {
        Scoreboard.getInstance().score(this.dataset.user, 1);
        refreshScoreboard();
    });
}

$('#addSongDiv input').keypress((e) => {
    if (e.keyCode === 13) { // press enter key
        e.preventDefault();
        $('#addSongBtn').click();
    }
});

$('#addSongBtn').on('click', function () {
    var fields = ['#artistInput', '#titleInput', '#penaltyInput', '#pointsInput'];
    var isValid = true;

    for (var i = 0; i < fields.length; i++) {
        var fieldValue = $(fields[i]).val();
        if (fieldValue === ''&& i!==2) {
            $(fields[i]).css('border-color', 'red');
            isValid = false;
        } else {
            $(fields[i]).css('border-color', '');
        }
    }

    if (!isValid) {
        toastMessage.sendError('Veuillez remplir tous les champs.');
    } else {
        const artist = $('#artistInput').val();
        const title = $('#titleInput').val();
        const penalty = $('#penaltyInput').val();
        const points = $('#pointsInput').val();

        toastMessage.sendInfo('La musique a bien été ajoutée.');
        Songlist.getInstance().addSong(artist, title, penalty, points);
        refreshSongList();
    }
});

$('input').on('input', function () {
    if ($(this).val() !== '') {
        $(this).css('border-color', '');
    }
});

$('img#hide').on('click', function () {
    $("#songlist table").toggleClass("blur");
});


function announceResult(username, solution, isPenalty, points) {
    const message = isPenalty
        ? `Hahaha pfff trop nul @${username}, tu es tombé dans le piège ! Le malus était ${solution}. Tu perds ${points} points !`
        : `Bravo @${username}, tu as trouvé ${solution} ! +${points} points.`;
    toastMessage.sendInfo(message);
    Client.getInstance().sendMessage(message);
}