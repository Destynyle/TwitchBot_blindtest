class Client {
    static instance = null;

    constructor() {
        $.getJSON("config/twitch_credentials.json", (twitchCredentials) => {
            this.initTmiClient(twitchCredentials);
            this.songlist = Songlist.getInstance();
            this.cmdMgr = new CommandsManager();
            this.songlist.stratGame();
            onClientStrarted();

            this.tmiClient.on('message', (channel, tags, message, self) => {
                this.onMessage(channel, tags, message, self);
            });
        }).fail(() => {
            toastMessage.sendError(`Aucun fichier twitch_credentials.json existant.`);
        });
    }

    static getInstance() {
        if (Client.instance === null) Client.instance = new Client();
        return Client.instance;
    }

    initTmiClient(twitchCredentials) {
        this.tmiClient = new tmi.Client({
            options: { debug: false }, // False in prod mode
            identity: {
                username: twitchCredentials.botname,
                password: twitchCredentials.oauthKey
            },
            channels: twitchCredentials.twitchChannels
        });

        this.channels = twitchCredentials.twitchChannels;

        this.tmiClient.connect().then(() => {
            toastMessage.sendSuccess('Le bot est bien connecté !');
          })
          .catch(err => {
            toastMessage.sendError(`Le bot n'a pas réussi a se connecter. Vérifiez les données du fichier twitch_credentials.json`);
          });
    }

    onMessage(channel, tags, message, self) {
        if (self) return;

        if (message.startsWith('!')) {
            const args = message.slice(1).split(' ').map(s => s.trim());
            const command = args.shift().toLowerCase();
            this.tmiClient.say(channel, this.cmdMgr.getCommand(command, tags.username));
            return;
        }

        const songlist = Songlist.getInstance();
        if (songlist.isGameStrated()) {
            const response = songlist.checkSong(message, tags.username);

            if (response.isOk) {
                const points = response.points;
                Scoreboard.getInstance().score(tags.username, points);
                refreshScoreboard();
                announceResult(tags.username, response.solution, points < 0, Math.abs(points));

                if (response.isComplete) {
                    this.tmiClient.say(channel, `🎉 Artiste et titre trouvés ! ${songlist.getCurrentSong().artist} - ${songlist.getCurrentSong().title}. La manche se termine dans 6 secondes !`);
                }
            }
        }
    }


    sendMessage(pMessage) {
        this.channels.forEach(channel => this.tmiClient.say(channel, pMessage));
    }
}

Client.getInstance();