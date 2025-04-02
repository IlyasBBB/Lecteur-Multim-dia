class MediaPlayer {
    constructor() {
        this.fileInput = document.getElementById('fileInput');
        this.uploadArea = document.getElementById('uploadArea');
        this.videoPlayer = document.getElementById('mediaPlayer');
        this.audioPlayer = document.getElementById('audioPlayer');
        this.libraryList = document.getElementById('libraryList');
        this.playlistContainer = document.getElementById('playlistContainer');
        this.mediaTitle = document.getElementById('mediaTitle');
        this.mediaType = document.getElementById('mediaType');
        this.mediaThumbnail = document.getElementById('mediaThumbnail');
        
        this.library = this.loadLibrary();
        this.currentMedia = null;
        
        // YouTube API key
        this.YOUTUBE_API_KEY = 'AIzaSyCnG4gC1azgFtCwfEveIuRCweqiSkoC6fk';
        this.currentMode = 'local';
        
        // YouTube Music base URL
        this.YT_MUSIC_BASE_URL = 'https://music.youtube.com';
        
        // Search types
        this.searchTypes = {
            MUSIC: 'music',
            VIDEO: 'video'
        };
        this.currentSearchType = this.searchTypes.MUSIC;
        
        // YouTube player reference
        this.ytPlayer = null;
        this.apiLoaded = false;
        
        // Cache pour les résultats YouTube
        this.searchCache = new Map();
        this.cacheExpiration = 30 * 60 * 1000; // 30 minutes

        // Charger l'API YouTube dès le début
        this.loadYouTubeIframeAPI();
        
        // Historique des médias joués
        this.mediaHistory = this.loadMediaHistory();
        
        // S'assurer que le mediaPlayer est masqué au chargement
        if (this.videoPlayer) {
            this.videoPlayer.classList.remove('active');
        }
        
        this.initializeBasicFeatures();
    }

    initializeBasicFeatures() {
        this.initializeEventListeners();
        this.renderLibrary();
        this.renderPlaylist();
        this.initializeModeSwitch();
        
        // Charger les médias locaux depuis le serveur
        this.loadLibraryFromServer();
        
        // Initialiser les playlists
        this.initializePlaylists();
        
        // Initialiser les contrôles de lecture
        this.initializeMediaControls();
    }

    initializeEventListeners() {
        console.log("Initialisation des écouteurs d'événements");
        
        this.uploadArea.addEventListener('click', () => {
            console.log("Zone d'upload cliquée, ouverture du sélecteur de fichiers");
            this.fileInput.click();
        });
        
        this.fileInput.addEventListener('change', (event) => {
            console.log("Fichiers sélectionnés via l'input:", event.target.files.length);
            if (event.target.files.length > 0) {
                this.handleFiles(event.target.files);
            } else {
                console.log("Aucun fichier sélectionné");
            }
        });

        // Gestion du drag & drop
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("Drag over détecté");
            this.uploadArea.classList.add('drag-over');
        });
        
        document.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("Drag leave détecté");
            this.uploadArea.classList.remove('drag-over');
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("Drop détecté avec", e.dataTransfer.files.length, "fichier(s)");
            this.uploadArea.classList.remove('drag-over');
            
            if (e.dataTransfer.files.length > 0) {
                this.handleFiles(e.dataTransfer.files);
            } else {
                console.log("Aucun fichier dans le drop");
            }
        });
        
        // Combinaison de touches pour réinitialiser la bibliothèque en cas de problème (Ctrl+Shift+R)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'R') {
                e.preventDefault();
                if (confirm('ATTENTION: Voulez-vous réinitialiser complètement la bibliothèque? Cette action supprimera tous vos médias importés.')) {
                    this.resetLibrary();
                }
            }
        });
    }

    async handleFiles(files) {
        console.log("handleFiles appelé avec", files.length, "fichier(s)");
        for (const file of files) {
            console.log("Vérification du fichier:", file.name, "Type:", file.type);
            if (file.type.startsWith('video/') || file.type.startsWith('audio/') || file.type.startsWith('image/')) {
                console.log("Type de fichier valide, ajout à la bibliothèque:", file.type);
                await this.addToLibrary(file);
            } else {
                console.warn("Type de fichier non supporté:", file.type);
            }
        }
        console.log("Traitement des fichiers terminé");
    }

    async addToLibrary(file) {
        console.log("Ajout du fichier à la bibliothèque:", file.name, "Type:", file.type, "Taille:", Math.round(file.size / 1024), "KB");
        
        try {
            // Vérifier si le type de fichier est supporté en détail
            if (file.type.startsWith('video/')) {
                // Types de vidéo supportés par la plupart des navigateurs
                const supportedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
                if (!supportedVideoTypes.includes(file.type)) {
                    console.warn(`Type de vidéo potentiellement non supporté: ${file.type}. Les formats recommandés sont MP4, WebM ou OGG.`);
                    alert(`Le format vidéo ${file.type} pourrait ne pas être supporté par tous les navigateurs. Pour une meilleure compatibilité, utilisez MP4, WebM ou OGG.`);
                }
            }
            
            // Convertir le fichier en base64
            const base64Data = await this.fileToBase64(file);
            console.log("Conversion en base64 réussie. Taille approximative:", Math.round(base64Data.length / 1024), "KB");
            
            const mediaItem = {
                id: Date.now() + Math.random(),
                name: file.name,
                type: file.type,
                size: file.size,
                added: new Date().toISOString(),
                lastPlayed: null,
                blob: base64Data
            };
            
            this.library.unshift(mediaItem);
            this.saveLibrary();
            this.renderLibrary();
            this.renderPlaylist();
            console.log("Fichier ajouté à la bibliothèque avec succès:", mediaItem.name);
        } catch (error) {
            console.error("Erreur lors de l'ajout du fichier à la bibliothèque:", error);
            alert(`Erreur lors de l'ajout du fichier ${file.name}: ${error.message}`);
        }
    }

    fileToBase64(file) {
        console.log("Conversion du fichier en base64:", file.name, "Type:", file.type, "Taille:", Math.round(file.size / 1024), "KB");
        
        return new Promise((resolve, reject) => {
            // Pour les fichiers vidéo volumineux, ajouter un message de progression
            if (file.type.startsWith('video/') && file.size > 10 * 1024 * 1024) { // Plus de 10 MB
                console.log("Fichier vidéo volumineux détecté, la conversion peut prendre un moment");
                alert("Conversion d'une vidéo volumineuse en cours. Veuillez patienter...");
            }
            
            const reader = new FileReader();
            
            // Ajouter un gestionnaire de progression
            reader.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percentLoaded = Math.round((event.loaded / event.total) * 100);
                    console.log(`Progression de la lecture: ${percentLoaded}%`);
                }
            };
            
            reader.onload = () => {
                console.log("Fichier lu avec succès, taille des données:", Math.round(reader.result.length / 1024), "KB");
                
                // Vérifier si le résultat est une URL de données valide
                if (reader.result.startsWith('data:')) {
                    resolve(reader.result);
                } else {
                    console.error("Le résultat n'est pas une URL de données valide");
                    reject(new Error("Format de données incorrect"));
                }
            };
            
            reader.onerror = (error) => {
                console.error("Erreur lors de la lecture du fichier:", error);
                console.error("Code d'erreur:", reader.error.code);
                reject(error);
            };
            
            try {
                reader.readAsDataURL(file);
            } catch (error) {
                console.error("Exception pendant l'appel à readAsDataURL:", error);
                reject(error);
            }
        });
    }

    playMedia(mediaItem) {
        console.log('Lecture du média:', mediaItem);
        console.log('Type du média:', mediaItem.type);
        if (mediaItem.path) console.log('Chemin du média:', mediaItem.path);
        if (mediaItem.blob) console.log('Blob du média disponible:', mediaItem.blob.substring(0, 50) + '...');
        
        // Marquer comme dernier lu
        mediaItem.lastPlayed = new Date().toISOString();
        this.currentMedia = mediaItem;
        this.saveLibrary();
        
        // Ajouter à l'historique
        this.addToHistory(mediaItem);
        
        // Mettre à jour l'interface
        document.getElementById('mediaTitle').textContent = mediaItem.name;
        document.getElementById('mediaType').textContent = mediaItem.type;
        
        // Déterminer le type de média
        if (mediaItem.type.startsWith('audio/')) {
            this.playAudioFile(mediaItem);
        } else if (mediaItem.type.startsWith('video/')) {
            this.playVideoFile(mediaItem);
        } else if (mediaItem.type.startsWith('image/')) {
            this.displayImage(mediaItem);
        } else {
            console.error('Type de média non pris en charge:', mediaItem.type);
        }
        
        // Rafraîchir l'affichage de la bibliothèque pour mettre en évidence l'élément actif
        this.renderLibrary();
        this.renderPlaylist();
    }

    saveLibrary() {
        console.log("Sauvegarde de la bibliothèque dans localStorage...");
        try {
            const librarySize = JSON.stringify(this.library).length;
            console.log(`Taille de la bibliothèque: ${Math.round(librarySize / 1024 / 1024)} MB`);
            
            // Si la bibliothèque est volumineuse, prévenir l'utilisateur
            if (librarySize > 4 * 1024 * 1024) { // Plus de 4 MB
                console.warn("La bibliothèque est très volumineuse, risque d'erreur de stockage");
                alert("Attention: Votre bibliothèque devient volumineuse. Les navigateurs limitent généralement le localStorage à environ 5 MB. Les vidéos volumineuses pourraient ne pas être sauvegardées correctement.");
            }
            
            try {
                localStorage.setItem('mediaLibrary', JSON.stringify(this.library));
                console.log("Bibliothèque sauvegardée avec succès");
            } catch (e) {
                if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                    console.error("Erreur de quota localStorage dépassé:", e);
                    alert("Erreur: L'espace de stockage du navigateur est plein. Impossible de sauvegarder la bibliothèque. Supprimez certains médias pour libérer de l'espace.");
                    
                    // Tenter de sauvegarder sans les vidéos volumineuses
                    const smallerLibrary = this.library.map(item => {
                        // Créer une copie sans modifier l'original
                        const copy = {...item};
                        
                        // Supprimer les blobs volumineux pour les vidéos
                        if (item.type && item.type.startsWith('video/') && item.blob && item.blob.length > 1000000) {
                            copy.blob = "BLOB_TOO_LARGE";
                            copy.blobRemoved = true;
                        }
                        return copy;
                    });
                    
                    try {
                        localStorage.setItem('mediaLibrary', JSON.stringify(smallerLibrary));
                        console.log("Bibliothèque sauvegardée partiellement (sans les grands blobs vidéo)");
                        alert("La bibliothèque a été sauvegardée partiellement. Les vidéos volumineuses devront être réimportées.");
                    } catch (innerError) {
                        console.error("Échec de la sauvegarde, même après optimisation:", innerError);
                    }
                } else {
                    console.error("Erreur lors de la sauvegarde de la bibliothèque:", e);
                    alert("Erreur lors de la sauvegarde de votre bibliothèque: " + e.message);
                }
            }
        } catch (error) {
            console.error("Erreur critique lors de la préparation de la sauvegarde:", error);
        }
    }
    
    loadLibrary() {
        console.log("Chargement de la bibliothèque depuis localStorage...");
        try {
            const saved = localStorage.getItem('mediaLibrary');
            if (saved) {
                const library = JSON.parse(saved);
                console.log(`Bibliothèque chargée: ${library.length} éléments`);
                
                // Vérifier les éléments qui ont eu leurs blobs supprimés
                const itemsWithMissingBlobs = library.filter(item => item.blobRemoved).length;
                if (itemsWithMissingBlobs > 0) {
                    console.warn(`${itemsWithMissingBlobs} vidéos volumineuses ont des blobs manquants et devront être réimportées`);
                }
                
                return library;
            } else {
                console.log("Aucune bibliothèque sauvegardée trouvée, création d'une nouvelle bibliothèque");
                return [];
            }
        } catch (error) {
            console.error("Erreur lors du chargement de la bibliothèque:", error);
            alert("Erreur lors du chargement de votre bibliothèque. Une nouvelle bibliothèque vide sera créée.");
            return [];
        }
    }

    renderLibrary() {
        this.libraryList.innerHTML = '';
        
        if (this.library.length === 0) {
            this.libraryList.innerHTML = '<div class="no-library-items">Votre bibliothèque est vide. Ajoutez des fichiers audio, vidéo ou image.</div>';
            return;
        }
        
        // Ajouter les statistiques de la bibliothèque
        const libraryStats = this.getLibraryStats();
        const statsElement = document.createElement('div');
        statsElement.className = 'library-stats';
        statsElement.innerHTML = `
            <div class="stats-item">
                <i class="fas fa-file-audio"></i>
                <span>${libraryStats.audio} audio</span>
            </div>
            <div class="stats-item">
                <i class="fas fa-file-video"></i>
                <span>${libraryStats.video} vidéo</span>
            </div>
            <div class="stats-item">
                <i class="fas fa-file-image"></i>
                <span>${libraryStats.image} image</span>
            </div>
            <div class="stats-item">
                <i class="fas fa-database"></i>
                <span>${libraryStats.totalSizeMB} MB</span>
            </div>
            <button class="clear-library-btn" title="Vider la bibliothèque">
                <i class="fas fa-trash-alt"></i> Tout supprimer
            </button>
        `;
        
        // Ajouter l'événement sur le bouton de suppression générale
        const clearBtn = statsElement.querySelector('.clear-library-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearLibrary();
            });
        }
        
        this.libraryList.appendChild(statsElement);
        
        this.library.forEach(item => {
            const mediaElement = document.createElement('div');
            mediaElement.className = 'media-library-item';
            
            // Déterminer le type d'icône à afficher
            let icon = 'fas fa-music'; // audio par défaut
            if (item.type && item.type.startsWith('video/')) {
                icon = 'fas fa-film';
            } else if (item.type && item.type.startsWith('image/')) {
                icon = 'fas fa-image';
            }
            
            mediaElement.innerHTML = `
                <div class="media-library-thumbnail">
                    <i class="${icon}"></i>
                </div>
                <div class="media-library-info">
                    <h4>${item.name}</h4>
                    <p>Ajouté le ${new Date(item.added).toLocaleDateString()}</p>
                </div>
                <div class="media-library-actions">
                    <button class="delete-media-btn" data-id="${item.id}" title="Supprimer">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            // Si l'élément est en cours de lecture, ajouter la classe active
            if (this.currentMedia && this.currentMedia.id === item.id) {
                mediaElement.classList.add('active');
            }
            
            // Ajouter le clic pour lire le média
            mediaElement.addEventListener('click', (e) => {
                // Ne pas déclencher la lecture si on a cliqué sur le bouton de suppression
                if (!e.target.closest('.delete-media-btn')) {
                    this.playMedia(item);
                }
            });
            
            // Ajouter l'événement pour le bouton de suppression
            const deleteBtn = mediaElement.querySelector('.delete-media-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Empêcher la propagation du clic
                    this.deleteMedia(item.id);
                });
            }
            
            this.libraryList.appendChild(mediaElement);
        });
    }
    
    // Méthode pour vider la bibliothèque
    clearLibrary() {
        if (!confirm("ATTENTION: Voulez-vous vraiment supprimer TOUS les médias de votre bibliothèque?")) {
            return;
        }
        
        // Confirmation supplémentaire pour éviter les erreurs
        if (!confirm("Cette action est irréversible. Confirmez-vous la suppression de tous les médias?")) {
            return;
        }
        
        try {
            console.log("Suppression de tous les médias de la bibliothèque");
            
            // Arrêter toute lecture en cours
            const audioPlayer = document.getElementById('audioPlayer');
            if (audioPlayer) {
                audioPlayer.pause();
                audioPlayer.src = '';
                audioPlayer.style.display = 'none';
            }
            
            const mediaPlayer = document.getElementById('mediaPlayer');
            if (mediaPlayer) {
                const videoElement = mediaPlayer.querySelector('video');
                if (videoElement) {
                    videoElement.pause();
                }
                mediaPlayer.innerHTML = '';
                mediaPlayer.classList.remove('active');
            }
            
            // Réinitialiser les informations d'affichage
            document.getElementById('mediaTitle').textContent = 'Aucun fichier sélectionné';
            document.getElementById('mediaType').textContent = '';
            document.getElementById('mediaThumbnail').innerHTML = '<i class="fas fa-music"></i>';
            
            // Arrêter la lecture de playlist si en cours
            const mediaControls = document.getElementById('mediaControls');
            const playingFromPlaylist = document.getElementById('playingFromPlaylist');
            if (mediaControls) mediaControls.style.display = 'none';
            if (playingFromPlaylist) playingFromPlaylist.style.display = 'none';
            
            // Vider la bibliothèque
            this.library = [];
            this.currentMedia = null;
            this.currentPlaylist = null;
            this.currentPlaylistIndex = -1;
            
            // Mettre à jour toutes les playlists pour enlever les références aux médias supprimés
            if (this.playlists && this.playlists.length > 0) {
                this.playlists.forEach(playlist => {
                    playlist.items = [];
                });
                this.savePlaylists();
                this.renderPlaylists();
            }
            
            // Sauvegarder et mettre à jour l'interface
            this.saveLibrary();
            this.renderLibrary();
            this.renderPlaylist();
            
            console.log("Bibliothèque vidée avec succès");
        } catch (error) {
            console.error("Erreur lors de la suppression de tous les médias:", error);
            alert("Une erreur est survenue lors de la suppression: " + error.message);
        }
    }
    
    // Méthode pour calculer les statistiques de la bibliothèque
    getLibraryStats() {
        let audio = 0;
        let video = 0;
        let image = 0;
        let totalSize = 0;
        
        this.library.forEach(item => {
            // Compter par type
            if (item.type && item.type.startsWith('audio/')) {
                audio++;
            } else if (item.type && item.type.startsWith('video/')) {
                video++;
            } else if (item.type && item.type.startsWith('image/')) {
                image++;
            }
            
            // Ajouter la taille
            if (item.size) {
                totalSize += item.size;
            } else if (item.blob) {
                // Estimation approximative pour les blobs (si la taille n'est pas disponible)
                totalSize += item.blob.length * 0.75; // Conversion approximative de base64 à binaire
            }
        });
        
        // Convertir en MB avec 1 décimale
        const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(1);
        
        return {
            audio,
            video,
            image,
            total: this.library.length,
            totalSizeMB
        };
    }
    
    // Méthode pour supprimer un fichier de la bibliothèque
    deleteMedia(mediaId) {
        console.log("Tentative de suppression du média avec ID:", mediaId);
        
        // Demander confirmation
        if (!confirm("Voulez-vous vraiment supprimer ce média de votre bibliothèque?")) {
            return;
        }
        
        try {
            // Trouver l'index du média à supprimer
            const mediaIndex = this.library.findIndex(item => item.id === mediaId);
            
            if (mediaIndex === -1) {
                console.error("Média non trouvé dans la bibliothèque");
                return;
            }
            
            const mediaItem = this.library[mediaIndex];
            console.log("Suppression du média:", mediaItem.name);
            
            // Si ce média est en cours de lecture, arrêter la lecture
            if (this.currentMedia && this.currentMedia.id === mediaId) {
                console.log("Arrêt de la lecture du média en cours de suppression");
                
                // Arrêter la lecture audio si active
                const audioPlayer = document.getElementById('audioPlayer');
                if (audioPlayer && audioPlayer.style.display !== 'none') {
                    audioPlayer.pause();
                    audioPlayer.src = '';
                    audioPlayer.style.display = 'none';
                }
                
                // Arrêter la lecture vidéo si active
                const mediaPlayer = document.getElementById('mediaPlayer');
                if (mediaPlayer && mediaPlayer.classList.contains('active')) {
                    const videoElement = mediaPlayer.querySelector('video');
                    if (videoElement) {
                        videoElement.pause();
                    }
                    mediaPlayer.innerHTML = '';
                    mediaPlayer.classList.remove('active');
                }
                
                // Réinitialiser les informations affichées
                document.getElementById('mediaTitle').textContent = 'Aucun fichier sélectionné';
                document.getElementById('mediaType').textContent = '';
                document.getElementById('mediaThumbnail').innerHTML = '<i class="fas fa-music"></i>';
                
                this.currentMedia = null;
            }
            
            // Supprimer le média de la bibliothèque
            this.library.splice(mediaIndex, 1);
            
            // Supprimer également ce média de toutes les playlists
            if (this.playlists && this.playlists.length > 0) {
                let playlistsUpdated = false;
                
                this.playlists.forEach(playlist => {
                    const itemIndex = playlist.items.findIndex(item => item.id === mediaId);
                    if (itemIndex !== -1) {
                        playlist.items.splice(itemIndex, 1);
                        playlistsUpdated = true;
                        
                        // Si c'est la playlist active et que l'élément était en cours de lecture
                        if (this.currentPlaylist && this.currentPlaylist.id === playlist.id && 
                            this.currentPlaylistIndex === itemIndex) {
                            
                            // Si la playlist est maintenant vide
                            if (playlist.items.length === 0) {
                                // Arrêter la lecture de la playlist
                                const mediaControls = document.getElementById('mediaControls');
                                const playingFromPlaylist = document.getElementById('playingFromPlaylist');
                                
                                if (mediaControls) mediaControls.style.display = 'none';
                                if (playingFromPlaylist) playingFromPlaylist.style.display = 'none';
                                
                                this.currentPlaylist = null;
                                this.currentPlaylistIndex = -1;
                            } else {
                                // Ajuster l'index si nécessaire
                                if (this.currentPlaylistIndex >= playlist.items.length) {
                                    this.currentPlaylistIndex = 0;
                                }
                                
                                // Jouer le prochain élément
                                this.playMedia(playlist.items[this.currentPlaylistIndex]);
                            }
                        }
                    }
                });
                
                if (playlistsUpdated) {
                    this.savePlaylists();
                    this.renderPlaylists();
                }
            }
            
            // Sauvegarder et mettre à jour l'interface
            this.saveLibrary();
            this.renderLibrary();
            this.renderPlaylist();
            
            console.log("Média supprimé avec succès");
        } catch (error) {
            console.error("Erreur lors de la suppression du média:", error);
            alert("Une erreur est survenue lors de la suppression: " + error.message);
        }
    }

    renderPlaylist() {
        this.playlistContainer.innerHTML = '';
        const recentlyPlayed = [...this.library]
            .filter(item => item.lastPlayed)
            .sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed))
            .slice(0, 8);

        recentlyPlayed.forEach(item => {
            const mediaElement = document.createElement('div');
            mediaElement.className = 'media-item';
            
            // Déterminer le type pour le badge et l'icône
            let mediaType = 'Audio'; // Par défaut
            let icon = 'fas fa-music';
            
            if (item.type && item.type.startsWith('video/')) {
                mediaType = 'Vidéo';
                icon = 'fas fa-film';
            } else if (item.type && item.type.startsWith('image/')) {
                mediaType = 'Image';
                icon = 'fas fa-image';
            }
            
            // Ajouter le type de média pour l'affichage du badge
            mediaElement.dataset.type = mediaType;
            
            mediaElement.innerHTML = `
                <div class="media-item-thumbnail">
                    <i class="${icon}"></i>
                </div>
                <div class="media-item-content">
                    <h4>${item.name}</h4>
                    <p>Dernière lecture: ${new Date(item.lastPlayed).toLocaleDateString()}</p>
                </div>
            `;
            mediaElement.addEventListener('click', () => this.playMedia(item));
            this.playlistContainer.appendChild(mediaElement);
        });
    }
    
    // Fonctions de gestion des playlists
    initializePlaylists() {
        // Initialiser la variable playlists et la charger depuis localStorage
        this.playlists = this.loadPlaylists();
        
        // Afficher les playlists
        this.renderPlaylists();
        
        // Ajouter les événements pour le bouton de création de playlist
        const createPlaylistBtn = document.getElementById('createPlaylistBtn');
        const playlistNameInput = document.getElementById('playlistNameInput');
        const addToPlaylistBtn = document.getElementById('addToPlaylistBtn');
        
        if (createPlaylistBtn && playlistNameInput) {
            createPlaylistBtn.addEventListener('click', () => {
                const name = playlistNameInput.value.trim();
                if (name) {
                    this.createPlaylist(name);
                    playlistNameInput.value = '';
                }
            });
        }
        
        if (addToPlaylistBtn) {
            addToPlaylistBtn.addEventListener('click', () => {
                if (this.currentMedia) {
                    const playlistName = prompt('Entrez le nom de la playlist:');
                    if (playlistName && playlistName.trim()) {
                        // Vérifier si la playlist existe déjà
                        let playlist = this.playlists.find(p => p.name === playlistName.trim());
                        
                        if (!playlist) {
                            // Créer une nouvelle playlist
                            playlist = this.createPlaylist(playlistName.trim());
                        }
                        
                        // Ajouter le média à la playlist
                        if (playlist) {
                            this.addToPlaylist(playlist.id, this.currentMedia);
                            alert(`Média ajouté à la playlist "${playlist.name}"`);
                        }
                    }
                } else {
                    alert('Veuillez d\'abord sélectionner un média.');
                }
            });
        }
    }
    
    loadPlaylists() {
        const saved = localStorage.getItem('mediaPlaylists');
        return saved ? JSON.parse(saved) : [];
    }
    
    savePlaylists() {
        localStorage.setItem('mediaPlaylists', JSON.stringify(this.playlists));
    }
    
    createPlaylist(name) {
        const playlist = {
            id: Date.now() + Math.random(),
            name: name,
            items: [],
            created: new Date().toISOString()
        };
        
        this.playlists.unshift(playlist);
        this.savePlaylists();
        this.renderPlaylists();
        return playlist;
    }
    
    addToPlaylist(playlistId, mediaItem) {
        const playlist = this.playlists.find(p => p.id === playlistId);
        if (playlist) {
            // Éviter les doublons
            if (!playlist.items.some(item => item.id === mediaItem.id)) {
                playlist.items.push(mediaItem);
                this.savePlaylists();
                this.renderPlaylists();
            }
        }
    }
    
    renderPlaylists() {
        const playlistsList = document.getElementById('playlistsList');
        if (!playlistsList) return;
        
        playlistsList.innerHTML = '';
        
        if (this.playlists.length === 0) {
            playlistsList.innerHTML = '<div class="no-playlists-message"><i class="fas fa-list"></i>Aucune playlist créée</div>';
            return;
        }
        
        this.playlists.forEach(playlist => {
            const card = document.createElement('div');
            card.className = 'playlist-card';
            
            // Si c'est la playlist active, ajouter la classe correspondante
            if (this.currentPlaylist && this.currentPlaylist.id === playlist.id) {
                card.classList.add('active-playlist');
            }
            
            card.innerHTML = `
                <h4>${playlist.name}</h4>
                <div class="playlist-info">
                    <p>${playlist.items.length} élément(s)</p>
                    <span class="playlist-date">Créée le ${new Date(playlist.created).toLocaleDateString()}</span>
                </div>
                <div class="playlist-actions">
                    <button class="play-playlist-btn" data-id="${playlist.id}">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="delete-playlist-btn" data-id="${playlist.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            // Ajouter les gestionnaires d'événements
            const playBtn = card.querySelector('.play-playlist-btn');
            const deleteBtn = card.querySelector('.delete-playlist-btn');
            
            if (playBtn) {
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.playPlaylist(playlist.id);
                });
            }
            
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Voulez-vous vraiment supprimer la playlist "${playlist.name}" ?`)) {
                        this.deletePlaylist(playlist.id);
                    }
                });
            }
            
            playlistsList.appendChild(card);
        });
    }
    
    playPlaylist(playlistId) {
        const playlist = this.playlists.find(p => p.id === playlistId);
        if (playlist && playlist.items.length > 0) {
            this.currentPlaylist = playlist;
            this.currentPlaylistIndex = 0;
            
            // Afficher les contrôles de playlist
            const mediaControls = document.getElementById('mediaControls');
            const playingFromPlaylist = document.getElementById('playingFromPlaylist');
            const currentPlaylistName = document.getElementById('currentPlaylistName');
            
            if (mediaControls) mediaControls.style.display = 'flex';
            if (playingFromPlaylist) playingFromPlaylist.style.display = 'flex';
            if (currentPlaylistName) currentPlaylistName.textContent = playlist.name;
            
            // Jouer le premier élément
            this.playMedia(playlist.items[0]);
            
            // Mettre à jour l'affichage des playlists pour marquer la playlist active
            this.renderPlaylists();
        }
    }
    
    playNextInPlaylist() {
        if (this.currentPlaylist && this.currentPlaylistIndex !== -1) {
            this.currentPlaylistIndex++;
            
            // Si on atteint la fin, revenir au début
            if (this.currentPlaylistIndex >= this.currentPlaylist.items.length) {
                this.currentPlaylistIndex = 0;
            }
            
            // Jouer le média
            this.playMedia(this.currentPlaylist.items[this.currentPlaylistIndex]);
        }
    }
    
    playPreviousInPlaylist() {
        if (this.currentPlaylist && this.currentPlaylistIndex !== -1) {
            this.currentPlaylistIndex--;
            
            // Si on est au début, aller à la fin
            if (this.currentPlaylistIndex < 0) {
                this.currentPlaylistIndex = this.currentPlaylist.items.length - 1;
            }
            
            // Jouer le média
            this.playMedia(this.currentPlaylist.items[this.currentPlaylistIndex]);
        }
    }

    initializeModeSwitch() {
        const modeBtns = document.querySelectorAll('.mode-btn');
        const searchArea = document.getElementById('searchArea');
        const uploadArea = document.getElementById('uploadArea');
        const searchType = document.getElementById('searchType');

        modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                modeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentMode = btn.dataset.mode;

                if (this.currentMode === 'youtube') {
                    searchArea.style.display = 'flex';
                    uploadArea.style.display = 'none';
                    searchType.value = 'music';
                    this.initializeSearch();
                } else if (this.currentMode === 'spotify') {
                    searchArea.style.display = 'flex';
                    uploadArea.style.display = 'none';
                    searchType.value = 'spotify';
                    this.initializeSpotify();
                    this.initializeSearch();
                } else {
                    searchArea.style.display = 'none';
                    uploadArea.style.display = 'block';
                    this.renderLibrary();
                }
            });
        });
    }

    initializeSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchButton = document.getElementById('searchButton');
        const searchType = document.getElementById('searchType');

        // Recherche en temps réel
        searchInput.addEventListener('input', async () => {
            const query = searchInput.value.trim();
            if (query.length >= 2) {
                const type = searchType.value;
                if (type === 'spotify') {
                    await this.searchSpotify(query);
                } else {
                    await this.performYouTubeSearch(query);
                }
            }
        });

        // Bouton de recherche
        searchButton.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (query) {
                const type = searchType.value;
                if (type === 'spotify') {
                    this.searchSpotify(query);
                } else {
                    this.performYouTubeSearch(query);
                }
            }
        });
    }

    async performYouTubeSearch(query) {
        try {
            // Afficher un message de chargement
            this.libraryList.innerHTML = '<div class="loading">Recherche en cours...</div>';

            // Vérifier le cache
            const cacheKey = `${query}-${document.getElementById('searchType').value}`;
            const cachedResults = this.getCachedResults(cacheKey);
            if (cachedResults) {
                this.renderYouTubeResults(cachedResults);
                return;
            }

            const searchType = document.getElementById('searchType').value;
            const isMusic = searchType === 'music';

            // Utiliser l'API YouTube avec la clé API (méthode fiable)
            const params = new URLSearchParams({
                part: 'snippet',
                q: query,
                maxResults: 20,
                key: this.YOUTUBE_API_KEY,
                type: 'video',
                regionCode: 'FR' 
            });

            if (isMusic) {
                params.append('videoCategoryId', '10');
                params.append('videoType', 'any');
            }

            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Origin': window.location.origin
                    },
                    mode: 'cors'
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error('YouTube API Error:', errorData);
                
                // Si erreur de quota, utiliser une méthode alternative
                if (errorData.error && errorData.error.code === 403 && errorData.error.message.includes('quota')) {
                    await this.performAlternativeYouTubeSearch(query, isMusic, cacheKey);
                    return;
                }
                
                throw new Error(errorData.error.message || `Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();
            if (data.items && data.items.length > 0) {
                // Mettre en cache les résultats
                this.cacheResults(cacheKey, data.items);
                this.renderYouTubeResults(data.items);
            } else {
                this.libraryList.innerHTML = '<div class="no-results">Aucun résultat trouvé</div>';
            }
        } catch (error) {
            console.error('Erreur lors de la recherche YouTube:', error);
            this.libraryList.innerHTML = `<div class="error">
                <p>Erreur lors de la recherche. Utilisation de la méthode de secours...</p>
            </div>`;
            
            // Tentative avec méthode alternative en cas d'erreur
            const searchType = document.getElementById('searchType').value;
            const isMusic = searchType === 'music';
            const cacheKey = `${query}-${searchType}`;
            
            try {
                await this.performAlternativeYouTubeSearch(query, isMusic, cacheKey);
            } catch (fallbackError) {
                console.error('Erreur méthode alternative:', fallbackError);
                
                // Afficher un message d'erreur amélioré avec des suggestions
                const videos = this.getFallbackVideos(isMusic);
                
                this.libraryList.innerHTML = `
                    <div class="error">
                        <p>Toutes les méthodes de recherche ont échoué.</p>
                        <p>Causes possibles :</p>
                        <ul>
                            <li>Problème de connexion internet</li>
                            <li>Les serveurs YouTube sont temporairement inaccessibles</li>
                            <li>Quotas d'API YouTube dépassés</li>
                        </ul>
                        <small>Conseils: Réessayez plus tard ou essayez avec un autre terme de recherche.</small>
                    </div>
                    <div class="suggestion-header">
                        <h3>Suggestions populaires en attendant</h3>
                    </div>
                `;
                
                // Ajouter des suggestions de vidéos populaires
                videos.forEach(video => {
                    const mediaElement = document.createElement('div');
                    mediaElement.className = 'media-item suggestion-item';
                    mediaElement.dataset.videoId = video.id.videoId;
                    
                    mediaElement.innerHTML = `
                        <div class="media-item-thumbnail">
                            <img src="${video.snippet.thumbnails.high.url}" alt="${video.snippet.title}" loading="lazy">
                        </div>
                        <div class="media-item-content">
                            <h4>${video.snippet.title}</h4>
                            <p>${video.snippet.channelTitle}</p>
                            <small><i class="fab fa-youtube"></i> <span>Suggestion populaire</span></small>
                        </div>
                    `;
                    
                    mediaElement.addEventListener('click', () => {
                        this.playYouTubeVideo(video.id.videoId, video.snippet);
                    });
                    
                    this.libraryList.appendChild(mediaElement);
                });
            }
        }
    }

    async performAlternativeYouTubeSearch(query, isMusic, cacheKey) {
        // Utiliser une méthode sans API key via un service proxy
        console.log('Utilisation de la méthode de recherche alternative pour:', query);
        
        // Liste de proxies à essayer en cas d'échec
        const proxyUrls = [
            'https://corsproxy.io/?',
            'https://api.allorigins.win/raw?url=',
            'https://cors-anywhere.herokuapp.com/'
        ];
        
        let success = false;
        let tryCount = 0;
        let videos = [];
        
        // Afficher un message de chargement
        this.libraryList.innerHTML = '<div class="loading">Tentative de recherche alternative...</div>';
        
        // Essayer différentes méthodes jusqu'à ce qu'une réussisse
        while (!success && tryCount < proxyUrls.length + 1) {
            try {
                if (tryCount === proxyUrls.length) {
                    // Dernière tentative avec des contenus populaires comme solution de secours
                    console.log("Tous les proxies ont échoué, affichage des suggestions de secours");
                    videos = this.getFallbackVideos(isMusic);
                    success = videos.length > 0;
                } else {
                    // Utiliser un proxy
                    const proxyUrl = proxyUrls[tryCount] + encodeURIComponent(
                        `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}${isMusic ? '+music' : ''}`
                    );
                    
                    console.log(`Tentative de proxy ${tryCount + 1}/${proxyUrls.length}:`, proxyUrls[tryCount]);
                    this.libraryList.innerHTML = `<div class="loading">Tentative de recherche alternative (${tryCount + 1}/${proxyUrls.length + 1})...</div>`;
                    
                    const response = await fetch(proxyUrl, {
                        headers: { 'Content-Type': 'text/html' },
                        mode: 'cors',
                        cache: 'no-cache'
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Erreur HTTP: ${response.status}`);
                    }
                    
                    const html = await response.text();
                    
                    // Extraire les données des vidéos avec une regex plus robuste
                    const videoDataRegex = /"videoRenderer":{"videoId":"([^"]+)".*?"title":{"runs":\[{"text":"([^"]+)"}.*?"ownerText":{"runs":\[{"text":"([^"]+)".*?"publishedTimeText":{"simpleText":"([^"]+)"/g;
                    
                    const matches = [...html.matchAll(videoDataRegex)];
                    
                    if (matches.length > 0) {
                        videos = matches.slice(0, 20).map(match => ({
                            id: { videoId: match[1] },
                            snippet: {
                                title: match[2].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'),
                                channelTitle: match[3],
                                publishedAt: this.convertPublishedTime(match[4]),
                                thumbnails: {
                                    high: {
                                        url: `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`
                                    }
                                }
                            }
                        }));
                        success = true;
                    } else {
                        // Essayer une autre méthode d'extraction
                        const videoIdRegex = /watch\?v=([a-zA-Z0-9_-]{11})/g;
                        const videoIds = [...new Set([...html.matchAll(videoIdRegex)].map(m => m[1]))];
                        
                        if (videoIds.length > 0) {
                            videos = videoIds.slice(0, 20).map(videoId => ({
                                id: { videoId },
                                snippet: {
                                    title: `Vidéo YouTube ${videoId}`,
                                    channelTitle: "Chaîne YouTube",
                                    publishedAt: new Date().toISOString(),
                                    thumbnails: {
                                        high: {
                                            url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
                                        }
                                    }
                                }
                            }));
                            success = true;
                        }
                    }
                }
            } catch (error) {
                console.error(`Échec de la tentative ${tryCount + 1}:`, error);
            }
            
            tryCount++;
        }
        
        if (success && videos.length > 0) {
            // Mettre en cache les résultats
            this.cacheResults(cacheKey, videos);
            this.renderYouTubeResults(videos);
        } else {
            throw new Error("Aucun résultat trouvé après avoir essayé toutes les méthodes alternatives");
        }
    }
    
    // Méthode pour obtenir des vidéos populaires comme solution de secours
    getFallbackVideos(isMusic) {
        // IDs de vidéos YouTube populaires comme solution de secours
        const musicIds = [
            'dQw4w9WgXcQ', // Rick Astley - Never Gonna Give You Up
            '9bZkp7q19f0', // PSY - Gangnam Style
            'kJQP7kiw5Fk', // Luis Fonsi - Despacito
            '_Yhyp-_hX2s', // Coldplay - Viva La Vida
            'JGwWNGJdvx8', // Ed Sheeran - Shape of You
            '8UVNT4wvIGY', // Gotye - Somebody That I Used To Know
            'OPf0YbXqDm0'  // Mark Ronson - Uptown Funk
        ];
        
        const videoIds = [
            'hD0JN3FmZSc', // Tutoriel YouTube
            'LXb3EKWsInQ', // Vidéo nature
            'Z1BCujX3pw8', // Trailer film
            'v9dWH0GqmWM', // Sports
            'YE7VzlLtp-4', // Actualités
            'gCYcHz2k5x0', // Musique populaire
            'C0DPdy98e4c'  // Animation
        ];
        
        const ids = isMusic ? musicIds : videoIds;
        const titles = isMusic ? 
            ["Never Gonna Give You Up", "Gangnam Style", "Despacito", "Viva La Vida", "Shape of You", "Somebody That I Used To Know", "Uptown Funk"] :
            ["Apprendre à utiliser YouTube", "Vidéo de Nature 4K", "Bande-annonce Film", "Moments Sportifs", "Actualités Internationales", "DJ Mix populaire", "Animation 3D"];
        
        const channels = isMusic ?
            ["Rick Astley", "PSY", "Luis Fonsi", "Coldplay", "Ed Sheeran", "Gotye", "Mark Ronson"] :
            ["YouTube Tutorials", "Nature Channel", "Movie Trailers", "Sports TV", "News Network", "Music Channel", "Animation Studio"];
        
        return ids.map((videoId, index) => ({
            id: { videoId },
            snippet: {
                title: titles[index] || `Vidéo YouTube Populaire`,
                channelTitle: channels[index] || "Chaîne YouTube",
                publishedAt: new Date().toISOString(),
                thumbnails: {
                    high: {
                        url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
                    }
                }
            }
        }));
    }

    convertPublishedTime(timeText) {
        // Convertir le texte de temps relatif en date
        const now = new Date();
        const units = {
            'second': 1000,
            'minute': 60 * 1000,
            'hour': 60 * 60 * 1000,
            'day': 24 * 60 * 60 * 1000,
            'week': 7 * 24 * 60 * 60 * 1000,
            'month': 30 * 24 * 60 * 60 * 1000,
            'year': 365 * 24 * 60 * 60 * 1000
        };

        // Format anglais
        let match = timeText.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/);
        if (match) {
            const value = parseInt(match[1]);
            const unit = match[2];
            const timestamp = now.getTime() - (value * units[unit]);
            return new Date(timestamp).toISOString();
        }

        // Format français
        match = timeText.match(/il y a (\d+)\s+(seconde|minute|heure|jour|semaine|mois|an)/);
        if (match) {
            const value = parseInt(match[1]);
            const unitMap = {
                'seconde': 'second',
                'minute': 'minute',
                'heure': 'hour',
                'jour': 'day',
                'semaine': 'week',
                'mois': 'month',
                'an': 'year'
            };
            const unit = unitMap[match[2]];
            const timestamp = now.getTime() - (value * units[unit]);
            return new Date(timestamp).toISOString();
        }

        return now.toISOString(); // Fallback to current date
    }

    getCachedResults(key) {
        const cached = this.searchCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiration) {
            return cached.data;
        }
        this.searchCache.delete(key);
        return null;
    }

    cacheResults(key, data) {
        // Limiter la taille du cache à 50 entrées
        if (this.searchCache.size >= 50) {
            const oldestKey = this.searchCache.keys().next().value;
            this.searchCache.delete(oldestKey);
        }
        this.searchCache.set(key, {
            timestamp: Date.now(),
            data: data
        });
    }

    renderYouTubeResults(videos) {
        this.libraryList.innerHTML = '';
        videos.forEach(video => {
            const mediaElement = document.createElement('div');
            mediaElement.className = 'media-item';
            // Stocker l'ID de la vidéo comme attribut de données
            mediaElement.dataset.videoId = video.id.videoId;
            // Ajouter le type de média pour l'affichage du badge
            const isMusic = document.getElementById('searchType').value === 'music';
            mediaElement.dataset.type = isMusic ? 'Musique' : 'Vidéo';
            
            // Format the published date
            const publishDate = new Date(video.snippet.publishedAt).toLocaleDateString();
            
            // Create thumbnail URL with better quality
            const thumbnailUrl = video.snippet.thumbnails.high ? video.snippet.thumbnails.high.url : video.snippet.thumbnails.default.url;
            
            mediaElement.innerHTML = `
                <div class="media-item-thumbnail">
                    <img src="${thumbnailUrl}" alt="${video.snippet.title}" loading="lazy">
                </div>
                <div class="media-item-content">
                    <h4>${video.snippet.title}</h4>
                    <p>${video.snippet.channelTitle}</p>
                    <small>
                        <i class="fab fa-youtube"></i> 
                        <span class="date">${publishDate}</span>
                    </small>
                </div>
            `;
            
            mediaElement.addEventListener('click', () => {
                this.playYouTubeVideo(video.id.videoId, video.snippet);
            });
            
            this.libraryList.appendChild(mediaElement);
        });
    }

    playYouTubeVideo(videoId, snippet) {
        // Arrêter les lecteurs en cours sans réinitialiser le mode Spotify
        
        // Masquer le lecteur Spotify sans le réinitialiser complètement
        if (this.spotifyEmbedPlayer) {
            this.spotifyEmbedPlayer.style.display = 'none';
        }
        if (this.previewPlayer) {
            this.previewPlayer.pause();
            this.previewPlayer.style.display = 'none';
        }
        
        // Vérifier si c'est une musique ou une vidéo
        const isMusic = document.getElementById('searchType').value === 'music';
        
        // Si player n'existe pas, le créer
        if (!this.ytPlayer) {
            this.initYouTubePlayer(videoId, isMusic);
        } else {
            // Si player existe, charger la nouvelle vidéo
            this.ytPlayer.loadVideoById(videoId);
            
            // Masquer ou afficher le lecteur en fonction du type
            if (isMusic) {
                this.videoPlayer.classList.remove('active');
            } else {
                this.videoPlayer.classList.add('active');
            }
        }

        // Mettre à jour les informations
        this.mediaTitle.textContent = snippet.title;
        this.mediaType.textContent = `${snippet.channelTitle} - ${isMusic ? 'YouTube Music' : 'YouTube Video'}`;
        this.mediaThumbnail.innerHTML = `
            <img src="https://i.ytimg.com/vi/${videoId}/hqdefault.jpg" 
                 alt="Thumbnail" style="width: 100%; height: 100%; object-fit: cover;">
        `;

        // Masquer le player audio
        this.audioPlayer.style.display = 'none';
        
        // Créer un contrôleur audio pour la musique si c'est de la musique
        if (isMusic && !this.ytMusicControls) {
            this.createMusicControls();
        }
        
        // Afficher les contrôles de musique pour YouTube Music
        if (isMusic && this.ytMusicControls) {
            this.ytMusicControls.style.display = 'flex';
        } else if (this.ytMusicControls) {
            this.ytMusicControls.style.display = 'none';
        }
        
        // Ajouter à l'historique
        this.addToHistory({
            videoId: videoId,
            name: snippet.title,
            channelName: snippet.channelTitle,
            source: 'youtube',
            isMusic: isMusic
        });
    }

    initYouTubePlayer(initialVideoId = '', isMusic = false) {
        // S'assurer que l'API est chargée
        if (!window.YT) {
            this.loadYouTubeIframeAPI();
        window.onYouTubeIframeAPIReady = () => {
                this.createYouTubePlayer(initialVideoId, isMusic);
            };
        } else {
            this.createYouTubePlayer(initialVideoId, isMusic);
        }
    }

    createYouTubePlayer(videoId, isMusic = false) {
        // Si c'est de la musique, masquer le bloc du lecteur
        if (isMusic) {
            this.videoPlayer.classList.remove('active');
        } else {
            this.videoPlayer.classList.add('active');
        }
        
        this.ytPlayer = new YT.Player('mediaPlayer', {
            height: '360',
            width: '640',
            videoId: videoId,
            playerVars: {
                'playsinline': 1,
                'controls': isMusic ? 0 : 1, // Masquer les contrôles pour la musique
                'autoplay': 1,
                'rel': 0, // Ne pas montrer les vidéos associées
                'modestbranding': 1, // Masquer le logo YouTube
                'showinfo': 0 // Masquer les informations de la vidéo
            },
            events: {
                'onReady': (event) => {
                    console.log('YouTube Player ready');
                    if (videoId) {
                        event.target.playVideo();
                    }
                },
                'onStateChange': this.onPlayerStateChange.bind(this),
                'onError': (event) => {
                    console.error('YouTube Player Error:', event.data);
                    this.mediaTitle.textContent = 'Erreur de lecture';
                }
            }
        });
    }

    // Ajouter une méthode pour créer des contrôles audio pour YouTube Music
    createMusicControls() {
        this.ytMusicControls = document.createElement('div');
        this.ytMusicControls.className = 'spotify-controls yt-music-controls';
        this.ytMusicControls.innerHTML = `
            <button class="control-btn" id="ytMusicPrevBtn"><i class="fas fa-step-backward"></i></button>
            <button class="control-btn" id="ytMusicPlayPauseBtn"><i class="fas fa-pause"></i></button>
            <button class="control-btn" id="ytMusicNextBtn"><i class="fas fa-step-forward"></i></button>
            <div class="yt-music-progress">
                <div class="progress-bar">
                    <div class="progress-filled"></div>
                </div>
                <span class="time-display">00:00 / 00:00</span>
            </div>
        `;
        
        // Ajouter les contrôles après le lecteur
        document.getElementById('mediaPlayer').parentNode.appendChild(this.ytMusicControls);
        
        // Ajouter les gestionnaires d'événements
        document.getElementById('ytMusicPlayPauseBtn').addEventListener('click', () => {
            if (this.ytPlayer) {
                const state = this.ytPlayer.getPlayerState();
                if (state === YT.PlayerState.PLAYING) {
                    this.ytPlayer.pauseVideo();
                    document.getElementById('ytMusicPlayPauseBtn').innerHTML = '<i class="fas fa-play"></i>';
                } else {
                    this.ytPlayer.playVideo();
                    document.getElementById('ytMusicPlayPauseBtn').innerHTML = '<i class="fas fa-pause"></i>';
                }
            }
        });
        
        document.getElementById('ytMusicPrevBtn').addEventListener('click', () => {
            if (this.ytPlayer) {
                // Rembobiner la vidéo au début
                this.ytPlayer.seekTo(0);
            }
        });
        
        document.getElementById('ytMusicNextBtn').addEventListener('click', () => {
            if (this.ytPlayer) {
                // Rechercher la prochaine chanson dans les résultats
                const currentItems = document.querySelectorAll('.media-item');
                if (currentItems.length > 1) {
                    // Trouver l'élément actuellement joué et passer au suivant
                    for (let i = 0; i < currentItems.length - 1; i++) {
                        if (currentItems[i].classList.contains('active')) {
                            currentItems[i+1].click();
                            break;
                        }
                    }
                }
            }
        });
        
        // Mettre à jour la barre de progression toutes les secondes
        setInterval(() => {
            if (this.ytPlayer && this.ytPlayer.getCurrentTime && this.ytMusicControls.style.display === 'flex') {
                const currentTime = this.ytPlayer.getCurrentTime() || 0;
                const duration = this.ytPlayer.getDuration() || 0;
                
                if (duration > 0) {
                    // Mettre à jour la barre de progression
                    const progressFilled = this.ytMusicControls.querySelector('.progress-filled');
                    const progressPercent = (currentTime / duration) * 100;
                    progressFilled.style.width = `${progressPercent}%`;
                    
                    // Mettre à jour l'affichage du temps
                    const timeDisplay = this.ytMusicControls.querySelector('.time-display');
                    timeDisplay.textContent = `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`;
                }
            }
        }, 1000);
    }
    
    // Méthode pour formater le temps en minutes:secondes
    formatTime(timeInSeconds) {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    onPlayerStateChange(event) {
        // Récupérer le bouton de lecture/pause
        const playPauseBtn = document.getElementById('ytMusicPlayPauseBtn');
        
        switch(event.data) {
            case YT.PlayerState.PLAYING:
                console.log('Video is playing');
                if (playPauseBtn) {
                    playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                }
                // Marquer l'élément actif dans la liste
                this.markActiveYouTubeItem(this.ytPlayer.getVideoData().video_id);
                break;
            case YT.PlayerState.PAUSED:
                console.log('Video is paused');
                if (playPauseBtn) {
                    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                }
                break;
            case YT.PlayerState.ENDED:
                console.log('Video has ended');
                if (playPauseBtn) {
                    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                }
                break;
            case YT.PlayerState.ERROR:
                console.error('Player error occurred');
                break;
        }
    }
    
    // Méthode pour marquer l'élément actuellement joué
    markActiveYouTubeItem(videoId) {
        // Retirer la classe active de tous les éléments
        document.querySelectorAll('.media-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Trouver l'élément avec le videoId correspondant et ajouter la classe active
        document.querySelectorAll('.media-item').forEach(item => {
            if (item.dataset.videoId === videoId) {
                item.classList.add('active');
            }
        });
    }

    loadYouTubeIframeAPI() {
        return new Promise((resolve, reject) => {
            if (window.YT) {
                resolve();
            return;
        }

            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

            window.onYouTubeIframeAPIReady = () => {
                this.apiLoaded = true;
                resolve();
            };

            // Timeout après 10 secondes
            setTimeout(() => {
                if (!window.YT) {
                    reject(new Error('YouTube API failed to load'));
                }
            }, 10000);
        });
    }

    initializeSpotify() {
        // Vérifier si nous sommes déjà configurés en mode Premium
        if (this.spotifyEmbedPlayer && !this.usingPreviewMode) {
            console.log('Configuration Spotify Premium déjà active');
            this.libraryList.innerHTML = `<div class="success">
                <p>Configuration Spotify Premium déjà active</p>
                <small>Recherchez des titres pour les écouter directement sur le site</small>
            </div>`;
            return;
        }

        // Charger le SDK Spotify, en tenant compte des indications de l'utilisateur
        this.libraryList.innerHTML = ``;
        
        // Vérifier si nous avons un token
        const token = localStorage.getItem('spotify_token');
        if (!token) {
            console.log('No token found, initiating login...');
            this.handleSpotifyLogin();
            return;
        }

        // Vérifier le type de compte
        this.checkSpotifyAccountType(token)
            .then(isPremium => {
                console.log(`Vérification de compte terminée: Premium = ${isPremium}`);
                
                if (isPremium) {
                    // Mettre à jour l'état global pour conserver le mode Premium même après avoir changé de sources
                    this.usingPreviewMode = false;
                    
                    
                    
                    // Créer le lecteur Premium avec la méthode Embed de Spotify
                    this.setupSpotifyEmbedPlayer();
                } else {
                    this.usingPreviewMode = true;
                    this.libraryList.innerHTML = `<div class="info-message">
                        <p>Mode prévisualisation activé</p>
                        <small>Recherchez des titres pour écouter les prévisualisations de 30 secondes</small>
                    </div>`;
                }
            })
            .catch(error => {
                console.error("Erreur lors de la vérification du compte:", error);
                this.usingPreviewMode = true;
                this.libraryList.innerHTML = `<div class="info-message">
                    <p>Mode prévisualisation activé</p>
                    <small>Recherchez des titres pour écouter les prévisualisations de 30 secondes</small>
                </div>`;
            });
    }
    
    // Nouvelle méthode pour configurer le lecteur Embed de Spotify
    setupSpotifyEmbedPlayer() {
        // Créer l'iframe pour Spotify Embed Player
        if (!this.spotifyEmbedPlayer) {
            this.spotifyEmbedPlayer = document.createElement('iframe');
            this.spotifyEmbedPlayer.style.width = '100%';
            this.spotifyEmbedPlayer.style.height = '80px';
            this.spotifyEmbedPlayer.style.border = 'none';
            this.spotifyEmbedPlayer.style.borderRadius = '8px';
            this.spotifyEmbedPlayer.style.display = 'none';
            this.spotifyEmbedPlayer.allow = "encrypted-media; autoplay";
            
            // Ajouter à la page
            document.getElementById('mediaPlayer').parentNode.appendChild(this.spotifyEmbedPlayer);
        }
        
        console.log('Lecteur Spotify Embed configuré');
    }

    async playSpotifyTrack(track) {
        console.log(`Lecture du titre Spotify: ${track.name}`);
        
        // Arrêter YouTube si en cours de lecture sans réinitialiser complètement Spotify
        if (this.ytPlayer) {
            this.ytPlayer.pauseVideo();
            this.videoPlayer.classList.remove('active');
            if (this.ytMusicControls) {
                this.ytMusicControls.style.display = 'none';
            }
        }
        
        // Si c'est une prévisualisation, utiliser le player audio HTML5
        if (this.usingPreviewMode || !track.uri) {
            if (track.preview_url) {
                this.playSpotifyPreview(track);
                return;
            } else {
                this.showTrackWithSpotifyLink(track);
                return;
            }
        }
        
        try {
            // Masquer les lecteurs existants
            if (this.ytPlayer) {
                this.videoPlayer.classList.remove('active');
            }
            if (this.previewPlayer) {
                this.previewPlayer.pause();
                this.previewPlayer.style.display = 'none';
            }
            
            // Mettre à jour les informations du média
            this.mediaTitle.textContent = track.name;
            this.mediaType.textContent = `${track.artists.map(a => a.name).join(', ')} - Spotify`;
            
            const albumImage = track.album.images.length > 0 
                ? track.album.images[0].url 
                : 'https://via.placeholder.com/150?text=No+Image';
                
            this.mediaThumbnail.innerHTML = `
                <img src="${albumImage}" 
                    alt="Album Cover" 
                    style="width: 100%; height: 100%; object-fit: cover;">
            `;
            
            // Utiliser le lecteur Embed
            if (this.spotifyEmbedPlayer) {
                const trackId = track.uri.split(":").pop();
                this.spotifyEmbedPlayer.src = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;
                this.spotifyEmbedPlayer.style.display = 'block';
                
                // Masquer les contrôles Spotify (non nécessaires avec Embed)
                if (this.spotifyControls) {
                    this.spotifyControls.style.display = 'none';
                }
                
                // Ajouter à l'historique
                this.addToHistory({
                    uri: track.uri,
                    name: track.name,
                    artists: track.artists.map(a => a.name),
                    image: track.album.images.length > 0 ? track.album.images[0].url : null,
                    preview_url: track.preview_url,
                    external_url: track.external_urls.spotify,
                    source: 'spotify'
                });
                
                console.log('Lecture via Spotify Embed');
                return;
            }
            
            // Si pas de lecteur Embed, essayer la prévisualisation
            if (track.preview_url) {
                console.log('Fallback vers prévisualisation');
                this.playSpotifyPreview(track);
            } else {
                this.showTrackWithSpotifyLink(track);
            }
        } catch (error) {
            console.error('Erreur lors de la lecture Spotify:', error);
            
            // En cas d'erreur, essayer la prévisualisation
            if (track.preview_url) {
                console.log('Fallback vers prévisualisation suite à erreur');
                this.playSpotifyPreview(track);
            } else {
                this.showTrackWithSpotifyLink(track);
            }
        }
    }
    
    // Méthode pour afficher un lien vers Spotify (quand rien d'autre ne fonctionne)
    showTrackWithSpotifyLink(track) {
        console.log('Affichage du lien Spotify pour:', track.name);
        
        // Cacher les contrôles Spotify s'ils sont affichés
        if (this.spotifyControls) {
            this.spotifyControls.style.display = 'none';
        }
        
        // Cacher les lecteurs existants
        if (this.previewPlayer) {
            this.previewPlayer.style.display = 'none';
        }
        if (this.spotifyEmbedPlayer) {
            this.spotifyEmbedPlayer.style.display = 'none';
        }
        
        // Afficher une image cliquable qui permet d'ouvrir Spotify
        const albumImage = track.album.images.length > 0 
            ? track.album.images[0].url 
            : 'https://via.placeholder.com/150?text=No+Image';
            
        this.mediaTitle.textContent = track.name;
        this.mediaType.textContent = `${track.artists.map(a => a.name).join(', ')} - Pas de prévisualisation disponible`;
        
        this.mediaThumbnail.innerHTML = `
            <a href="${track.external_urls.spotify}" target="_blank" style="display:block; width:100%; height:100%;">
                <img src="${albumImage}" 
                    alt="Album Cover" 
                    style="width: 100%; height: 100%; object-fit: cover;">
                <div style="position:absolute; top:0; left:0; width:100%; height:100%; 
                            display:flex; align-items:center; justify-content:center;
                            background:rgba(0,0,0,0.7); border-radius:4px;">
                    <span style="background:#1DB954; color:white; padding:8px 12px; border-radius:20px;">
                        <i class="fab fa-spotify" style="margin-right:5px;"></i> Écouter sur Spotify
                    </span>
                </div>
            </a>
        `;
        
        this.showSpotifyError(`Ce titre n'a pas de prévisualisation disponible. Écoutez-le directement sur Spotify.`, track);
    }
    
    renderSpotifyResults(tracks) {
        this.libraryList.innerHTML = '';
        
        if (tracks.length === 0) {
            this.libraryList.innerHTML = '<div class="no-results">Aucun résultat trouvé</div>';
            return;
        }
        
        // Compter les prévisualisations disponibles
        const tracksWithPreview = tracks.filter(track => track.preview_url);
        
        // Message d'information selon le mode
        const infoEl = document.createElement('div');
        infoEl.className = '';
        
        if (this.usingPreviewMode) {
            infoEl.innerHTML = `
                <p>Mode prévisualisation: extraits de 30 secondes uniquement</p>
                <p style="margin-top: 5px">Cliquez sur un titre sans prévisualisation pour l'ouvrir sur Spotify</p>
            `;
        } else {
            infoEl.innerHTML = `
                
            `;
        }
        
        this.libraryList.appendChild(infoEl);
        
        if (tracksWithPreview.length > 0 && this.usingPreviewMode) {
            const previewInfo = document.createElement('div');
            previewInfo.className = 'info-message success-info';
            previewInfo.innerHTML = `
                <p>${tracksWithPreview.length} piste(s) avec prévisualisation disponible</p>
            `;
            this.libraryList.appendChild(previewInfo);
        }
        
        tracks.forEach(track => {
            const mediaElement = document.createElement('div');
            mediaElement.className = 'media-item';
            // Ajouter le type de média pour l'affichage du badge
            mediaElement.dataset.type = 'Spotify';
            
            // Vérifier si une prévisualisation est disponible
            const hasPreview = !!track.preview_url;
            
            if (!hasPreview && this.usingPreviewMode) {
                mediaElement.classList.add('no-preview');
            }
            
            // Récupérer l'image de l'album
            const albumImage = track.album.images.length > 0 
                ? track.album.images[0].url 
                : 'https://via.placeholder.com/120?text=No+Image';
                
            mediaElement.innerHTML = `
                <div class="media-item-thumbnail">
                    <img src="${albumImage}" alt="${track.name}" loading="lazy">
                </div>
                <div class="media-item-content">
                    <h4>${track.name}</h4>
                    <p>${track.artists.map(artist => artist.name).join(', ')}</p>
                    <small>
                        <i class="fab fa-spotify"></i> ${track.album.name}
                        ${!this.usingPreviewMode ? 
                            '<span class="premium-badge">Premium</span>' : 
                            (hasPreview ? 
                                '<span class="preview-badge">Prévisualisation</span>' : 
                                '<span class="no-preview-badge">Pas de prévisualisation</span>')}
                    </small>
                </div>
            `;
            
            mediaElement.addEventListener('click', () => {
                if (this.usingPreviewMode) {
                    if (hasPreview) {
                        this.playSpotifyPreview(track);
                    } else {
                        window.open(track.external_urls.spotify, '_blank');
                    }
                } else {
                    // Mode Premium avec Embed
                    this.playSpotifyTrack(track);
                }
            });
            
            this.libraryList.appendChild(mediaElement);
        });
    }

    async checkSpotifyAccountType(token) {
        try {
            // Log complet du processus de vérification
            console.log('Vérification du type de compte Spotify...');
            
            const response = await fetch('https://api.spotify.com/v1/me', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                console.error(`Erreur HTTP lors de la vérification: ${response.status}`);
                if (response.status === 401) {
                    // Tentative de rafraîchissement du token
                    console.log('Token expiré, tentative de rafraîchissement...');
                    const refreshed = await this.refreshSpotifyToken();
                    if (refreshed) {
                        // Réessayer avec le nouveau token
                        return this.checkSpotifyAccountType(localStorage.getItem('spotify_token'));
                    }
                }
                throw new Error(`Erreur lors de la vérification du compte: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Réponse API compte:', data);
            
            // Vérification plus stricte du type de compte
            if (data.product === 'premium') {
                console.log('Compte Premium détecté ✓');
                
                return true;
            } else {
                console.log('Compte gratuit détecté ✗');
                // Toujours afficher qu'on utilise le mode prévisualisation pour éviter les erreurs
                this.libraryList.innerHTML = `<div class="info-message">
                    <p>Mode prévisualisation activé</p>
                    <small>Utilisation des prévisualisations de 30 secondes uniquement</small>
                </div>`;
                
                // Forcer le mode prévisualisation même si l'API a dit que c'était premium
                this.usingPreviewMode = true;
                return false;
            }
        } catch (error) {
            console.error('Erreur lors de la vérification du compte Spotify:', error);
            
            // Par défaut, utiliser le mode prévisualisation pour éviter les erreurs
            console.log('Problème de vérification - utilisation du mode prévisualisation par défaut');
            this.libraryList.innerHTML = `<div class="info-message">
                <p>Mode prévisualisation activé</p>
                <small>Utilisation des prévisualisations de 30 secondes uniquement</small>
            </div>`;
            this.usingPreviewMode = true;
            return false;
        }
    }

    // Méthode pour forcer le mode Premium
    forcePremiuMode() {
        this.loadSpotifySDK();
    }

    loadSpotifySDK() {
        // Si le SDK est déjà chargé, le décharger pour éviter les conflits
        if (window.Spotify) {
            console.log('Réinitialisation du SDK Spotify...');
            window.Spotify = undefined;
        }
        
        console.log('Chargement du SDK Spotify...');
        
        // Conserver une référence à l'instance actuelle pour le callback
        const self = this;
        
        // Définir la fonction de callback AVANT de charger le script
        window.onSpotifyWebPlaybackSDKReady = function() {
            console.log('Spotify Web Playback SDK prêt');
            self.initSpotifyPlayer();
        };
        
        const script = document.createElement('script');
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        
        script.onload = () => {
            console.log('Script SDK Spotify chargé avec succès');
        };
        
        document.body.appendChild(script);
    }
    
    initSpotifyPlayer() {
        const token = localStorage.getItem('spotify_token');
        if (!token) {
            console.error('Token manquant pour initialiser le player');
            return;
        }
        
        console.log('Initialisation du lecteur Spotify Premium');
        
        if (typeof Spotify === 'undefined') {
            console.error('SDK Spotify non chargé, réessai dans 1 seconde...');
            setTimeout(() => this.initSpotifyPlayer(), 1000);
            return;
        }
        
        try {
            // Initialiser le player avec le token d'authentification
            this.spotifyPlayer = new Spotify.Player({
                name: 'MediaPlayer Web App',
                getOAuthToken: cb => {
                    console.log('Obtention du token OAuth pour Spotify...');
                    cb(token);
                },
                volume: 0.5
            });
            
            // Gestionnaires d'événements
            this.spotifyPlayer.addListener('ready', ({ device_id }) => {
                console.log('Spotify Player Ready avec device ID:', device_id);
                this.spotifyDeviceId = device_id;
                
                this.libraryList.innerHTML = `<div class="success">
                    <p>Lecteur Spotify Premium connecté! ID: ${device_id.substring(0, 8)}...</p>
                    <small>Recherchez des titres pour commencer à écouter</small>
                </div>`;
                
                // Active le périphérique dès qu'il est prêt
                this.activateDevice(device_id);
            });
            
            this.spotifyPlayer.addListener('not_ready', ({ device_id }) => {
                console.log('Le périphérique est devenu indisponible:', device_id);
                this.spotifyDeviceId = null;
            });

            // Gestion des erreurs
            this.spotifyPlayer.addListener('initialization_error', ({ message }) => {
                console.error('Erreur d\'initialisation:', message);
                this.fallbackToPreviewMode(true, `Erreur d'initialisation: ${message}`);
            });

            this.spotifyPlayer.addListener('authentication_error', ({ message }) => {
                console.error('Erreur d\'authentification:', message);
                this.libraryList.innerHTML = `<div class="error">
                    <p>Erreur d'authentification Spotify</p>
                    <small>${message}</small>
                    <p>Tentative de reconnexion en cours...</p>
                </div>`;
                setTimeout(() => {
                localStorage.removeItem('spotify_token');
                this.handleSpotifyLogin();
                }, 2000);
            });

            this.spotifyPlayer.addListener('account_error', ({ message }) => {
                console.error('Erreur de compte:', message);
                // Si l'erreur est liée à un compte non premium
                if (message.includes('premium') || message.includes('Premium')) {
                    this.libraryList.innerHTML = `<div class="error">
                        <p>Compte Spotify Premium requis</p>
                        <small>${message}</small>
                        <p>Utilisation du mode prévisualisation à la place...</p>
                    </div>`;
                }
                this.fallbackToPreviewMode(true, message);
            });
            
            // État de la lecture
            this.spotifyPlayer.addListener('player_state_changed', state => {
                console.log('État de lecture changé:', state);
                if (state) {
                    // Mise à jour des contrôles de lecture
                    const isPlaying = !state.paused;
                    if (this.spotifyControls) {
                        document.getElementById('spotifyPlayPauseBtn').innerHTML = isPlaying 
                            ? '<i class="fas fa-pause"></i>' 
                            : '<i class="fas fa-play"></i>';
                    }
                    
                    // Mise à jour des informations de la piste en cours
                    if (state.track_window && state.track_window.current_track) {
                        const track = state.track_window.current_track;
                        this.mediaTitle.textContent = track.name;
                        this.mediaType.textContent = `${track.artists.map(a => a.name).join(', ')} - Spotify Premium`;
                        
                        if (track.album.images && track.album.images.length > 0) {
                            this.mediaThumbnail.innerHTML = `
                                <img src="${track.album.images[0].url}" 
                                    alt="Album Cover" 
                                    style="width: 100%; height: 100%; object-fit: cover;">
                            `;
                        }
                    }
                }
            });
            
            // Connecter le lecteur
            console.log('Tentative de connexion au lecteur Spotify...');
            this.spotifyPlayer.connect()
                .then(success => {
                    if (success) {
                        console.log('Connexion au lecteur Spotify réussie!');
                    } else {
                        console.log('Échec de la connexion au lecteur Spotify Premium');
                        this.fallbackToPreviewMode(true, "Impossible de se connecter au lecteur Spotify");
                    }
                })
                .catch(error => {
                    console.error('Erreur lors de la connexion au lecteur Spotify:', error);
                    this.fallbackToPreviewMode(true, error.message);
                });
        } catch (e) {
            console.error('Exception lors de l\'initialisation du player:', e);
            this.fallbackToPreviewMode(true, e.message);
        }
    }
    
    // Activer le périphérique Spotify
    async activateDevice(deviceId) {
        try {
            console.log('Activation du périphérique Spotify:', deviceId);
            const token = localStorage.getItem('spotify_token');
            
            // Nécessaire pour que le périphérique soit reconnu comme actif
            const response = await fetch('https://api.spotify.com/v1/me/player', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    device_ids: [deviceId],
                    play: false
                })
            });
            
            if (response.status === 204) {
                console.log('Périphérique activé avec succès');
            } else {
                console.warn('Réponse inattendue lors de l\'activation:', response.status);
            }
        } catch (error) {
            console.error('Erreur lors de l\'activation du périphérique:', error);
        }
    }

    playSpotifyPreview(track) {
        // Arrêter YouTube si en cours de lecture sans le réinitialiser complètement
        if (this.ytPlayer) {
            this.ytPlayer.pauseVideo();
            this.videoPlayer.classList.remove('active');
            if (this.ytMusicControls) {
                this.ytMusicControls.style.display = 'none';
            }
        }
        
        // Masquer l'embed Spotify s'il existe
        if (this.spotifyEmbedPlayer) {
            this.spotifyEmbedPlayer.style.display = 'none';
        }

        // Créer ou réutiliser l'élément audio
        if (!this.previewPlayer) {
            this.previewPlayer = document.createElement('audio');
            this.previewPlayer.controls = true;
            this.previewPlayer.style.width = '100%';
            document.getElementById('mediaPlayer').parentNode.appendChild(this.previewPlayer);
        }

        // Mettre à jour l'interface
        this.mediaTitle.textContent = track.name;
        this.mediaType.textContent = `${track.artists.map(a => a.name).join(', ')} - Prévisualisation Spotify (30s)`;
        
        // Récupérer l'image de l'album avec gestion d'erreur
        const albumImage = track.album.images.length > 0 
            ? track.album.images[0].url 
            : 'https://via.placeholder.com/150?text=No+Image';
            
        this.mediaThumbnail.innerHTML = `
            <img src="${albumImage}" 
                 alt="Album Cover" 
                 style="width: 100%; height: 100%; object-fit: cover;">
        `;

        // Jouer la prévisualisation
        this.previewPlayer.src = track.preview_url;
        this.previewPlayer.style.display = 'block';
        this.previewPlayer.play();
        
        // Ajouter à l'historique
        this.addToHistory({
            uri: track.uri,
            name: track.name,
            artists: track.artists.map(a => a.name),
            image: track.album.images.length > 0 ? track.album.images[0].url : null,
            preview_url: track.preview_url,
            external_urls: { 
                spotify: track.external_urls.spotify || `https://open.spotify.com/track/${track.uri.split(':').pop()}` 
            },
            source: 'spotify'
        });
    }

    async toggleSpotifyPlayback() {
        if (!this.spotifyDeviceId) return;
        
        try {
            if (this.spotifyPlayer) {
                // Utiliser directement le SDK si disponible (plus fiable)
                this.spotifyPlayer.togglePlay();
                return;
            }
            
            const token = localStorage.getItem('spotify_token');
            
            // Obtenir l'état actuel de la lecture
            const stateResponse = await fetch('https://api.spotify.com/v1/me/player', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!stateResponse.ok) {
                throw new Error(`Erreur HTTP: ${stateResponse.status}`);
            }
            
            const stateData = await stateResponse.json();
            const isPlaying = stateData.is_playing;
            
            // Action inverse de l'état actuel
            const endpoint = isPlaying ? 'pause' : 'play';
            
            const response = await fetch(`https://api.spotify.com/v1/me/player/${endpoint}?device_id=${this.spotifyDeviceId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            // Mise à jour de l'interface
            document.getElementById('spotifyPlayPauseBtn').innerHTML = isPlaying 
                ? '<i class="fas fa-play"></i>' 
                : '<i class="fas fa-pause"></i>';
            
        } catch (error) {
            console.error('Erreur lors du changement d\'état de lecture:', error);
        }
    }
    
    async spotifyPreviousTrack() {
        if (!this.spotifyDeviceId) return;
        
        try {
            if (this.spotifyPlayer) {
                // Utiliser directement le SDK si disponible
                this.spotifyPlayer.previousTrack();
                return;
            }
            
            const token = localStorage.getItem('spotify_token');
            const response = await fetch('https://api.spotify.com/v1/me/player/previous', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
        } catch (error) {
            console.error('Erreur lors du passage à la piste précédente:', error);
        }
    }
    
    async spotifyNextTrack() {
        if (!this.spotifyDeviceId) return;
        
        try {
            if (this.spotifyPlayer) {
                // Utiliser directement le SDK si disponible
                this.spotifyPlayer.nextTrack();
                return;
            }
            
            const token = localStorage.getItem('spotify_token');
            const response = await fetch('https://api.spotify.com/v1/me/player/next', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
        } catch (error) {
            console.error('Erreur lors du passage à la piste suivante:', error);
        }
    }

    showSpotifyError(message, track) {
        // Afficher une notification d'erreur temporaire
        const errorElement = document.createElement('div');
        errorElement.className = 'spotify-error-notification';
        errorElement.innerHTML = `
            <p>Problème de lecture Spotify</p>
            <small>${message}</small>
            ${track.preview_url ? '<p>Lecture de la prévisualisation à la place...</p>' : ''}
        `;
        
        document.body.appendChild(errorElement);
        
        // Supprimer après 5 secondes
        setTimeout(() => {
            errorElement.classList.add('fade-out');
            setTimeout(() => {
                document.body.removeChild(errorElement);
            }, 500);
        }, 5000);
    }

    ensureSpotifyControls() {
        // Créer une interface de contrôle pour la lecture Spotify si elle n'existe pas
        if (!this.spotifyControls) {
            this.spotifyControls = document.createElement('div');
            this.spotifyControls.className = 'spotify-controls';
            this.spotifyControls.innerHTML = `
                <button class="control-btn" id="spotifyPrevBtn"><i class="fas fa-step-backward"></i></button>
                <button class="control-btn" id="spotifyPlayPauseBtn"><i class="fas fa-pause"></i></button>
                <button class="control-btn" id="spotifyNextBtn"><i class="fas fa-step-forward"></i></button>
            `;
            document.getElementById('mediaPlayer').parentNode.appendChild(this.spotifyControls);
            
            // Ajouter les gestionnaires d'événements
            document.getElementById('spotifyPlayPauseBtn').addEventListener('click', () => {
                this.toggleSpotifyPlayback();
            });
            document.getElementById('spotifyPrevBtn').addEventListener('click', () => {
                this.spotifyPreviousTrack();
            });
            document.getElementById('spotifyNextBtn').addEventListener('click', () => {
                this.spotifyNextTrack();
            });
        }
        
        this.spotifyControls.style.display = 'flex';
    }

    handleSpotifyLogin() {
        // Afficher un message de connexion
        this.libraryList.innerHTML = '<div class="loading">Connexion à Spotify...</div>';
        
        console.log('Ouverture de la fenêtre de connexion Spotify');
        
        const width = 450;
        const height = 730;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);

        try {
        const authWindow = window.open(
            'http://localhost:8000/login',
            'Spotify Login',
            `width=${width},height=${height},left=${left},top=${top}`
        );

            if (!authWindow) {
                this.libraryList.innerHTML = `<div class="error">
                    <p>Le bloqueur de popups a empêché l'ouverture de la fenêtre de connexion</p>
                    <small>Veuillez autoriser les popups pour ce site</small>
                </div>`;
                return;
            }

            // Vérifier si la fenêtre a été fermée sans authentification
            const checkClosed = setInterval(() => {
                if (authWindow.closed) {
                    clearInterval(checkClosed);
                    // Si nous n'avons toujours pas de token, afficher un message
                    if (!localStorage.getItem('spotify_token')) {
                        this.libraryList.innerHTML = `<div class="error">
                            <p>Connexion à Spotify annulée ou échouée</p>
                            <small>Cliquez sur ce message pour réessayer</small>
                        </div>`;
                        this.libraryList.querySelector('.error').addEventListener('click', () => this.handleSpotifyLogin());
                    }
                }
            }, 1000);

        window.addEventListener('message', async (event) => {
                try {
                    console.log('Message reçu de la fenêtre d\'authentification:', event.origin);
                    
            if (event.data.access_token) {
                        console.log('Token reçu, sauvegarde en cours');
                localStorage.setItem('spotify_token', event.data.access_token);
                        
                        if (event.data.refresh_token) {
                localStorage.setItem('spotify_refresh_token', event.data.refresh_token);
                        }
                        
                        clearInterval(checkClosed);
                authWindow.close();
                        
                        // Actualiser l'interface
                        this.libraryList.innerHTML = '<div class="success">Connecté à Spotify! Recherchez des chansons pour écouter les prévisualisations.</div>';
                    }
                } catch (error) {
                    console.error('Erreur lors du traitement du message:', error);
                }
            }, { once: true });
            
        } catch (error) {
            console.error('Erreur lors de l\'ouverture de la fenêtre:', error);
            this.libraryList.innerHTML = `<div class="error">
                <p>Erreur lors de la connexion à Spotify</p>
                <small>${error.message}</small>
            </div>`;
        }
    }

    async searchSpotify(query) {
        try {
            // Afficher un message de chargement
            this.libraryList.innerHTML = '<div class="loading">Recherche Spotify en cours...</div>';
            
        const token = localStorage.getItem('spotify_token');
        if (!token) {
                this.libraryList.innerHTML = '<div class="error"><p>Connexion à Spotify requise</p><small>Cliquez sur ce message pour vous connecter</small></div>';
                this.libraryList.querySelector('.error').addEventListener('click', () => this.handleSpotifyLogin());
            return;
        }

            console.log('Token disponible, tentative de recherche Spotify');

        try {
                const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20&market=FR`, {
                headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                }
            });

                console.log('Statut de la réponse Spotify:', response.status);

            if (response.status === 401) {
                    console.log('Token expiré, tentative de rafraîchissement');
                    const refreshed = await this.refreshSpotifyToken();
                    if (refreshed) {
                        // Réessayer la recherche après rafraîchissement du token
                        this.searchSpotify(query);
                    } else {
                        throw new Error('Échec du rafraîchissement du token');
                    }
                return;
            }

                if (!response.ok) {
                    throw new Error(`Erreur Spotify: ${response.status} ${response.statusText}`);
                }

            const data = await response.json();
                console.log('Résultats obtenus:', data.tracks ? data.tracks.items.length : 0);
                
                if (data.tracks && data.tracks.items && data.tracks.items.length > 0) {
                    // Afficher tous les résultats, même sans prévisualisation
                    this.renderSpotifyResults(data.tracks.items);
                } else {
                    this.libraryList.innerHTML = '<div class="no-results">Aucun résultat trouvé sur Spotify</div>';
                }
            } catch (requestError) {
                console.error('Erreur de requête Spotify:', requestError);
                throw requestError;
            }
            
        } catch (error) {
            console.error('Erreur lors de la recherche Spotify:', error);
            this.libraryList.innerHTML = `<div class="error">
                <p>${error.message || 'Erreur de connexion à Spotify'}</p>
                <small>Vérifiez votre connexion Internet ou essayez de vous <a href="#" id="reconnectSpotify">reconnecter à Spotify</a></small>
            </div>`;
            
            document.getElementById('reconnectSpotify')?.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('spotify_token');
                localStorage.removeItem('spotify_refresh_token');
                this.handleSpotifyLogin();
            });
        }
    }

    async refreshSpotifyToken() {
        const refreshToken = localStorage.getItem('spotify_refresh_token');
        if (!refreshToken) {
            console.log('Pas de refresh token, reconnexion requise');
            this.handleSpotifyLogin();
            return false;
        }

        try {
            console.log('Tentative de rafraîchissement avec token:', refreshToken.substring(0, 5) + '...');
            
            const response = await fetch(`http://localhost:8000/refresh_token?refresh_token=${refreshToken}`);
            console.log('Réponse rafraîchissement:', response.status);
            
            if (!response.ok) {
                throw new Error(`Échec du rafraîchissement du token: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Données de rafraîchissement reçues:', !!data.access_token);
            
            if (data.access_token) {
                localStorage.setItem('spotify_token', data.access_token);
                console.log('Token rafraîchi avec succès');
                return true;
            } else {
                throw new Error('Token non reçu');
            }
        } catch (error) {
            console.error('Erreur lors du rafraîchissement du token:', error);
            // En cas d'échec de rafraîchissement, on force une nouvelle connexion
            this.libraryList.innerHTML = `<div class="error">
                <p>Impossible de rafraîchir la session Spotify</p>
                <small>Cliquez sur ce message pour vous reconnecter</small>
            </div>`;
            this.libraryList.querySelector('.error').addEventListener('click', () => {
                localStorage.removeItem('spotify_token');
                localStorage.removeItem('spotify_refresh_token');
                this.handleSpotifyLogin();
            });
            return false;
        }
    }

    // Initialiser les fonctionnalités de l'historique
    initializeHistory() {
        this.historyToggleBtn = document.getElementById('historyToggleBtn');
        this.historyDropdown = document.getElementById('historyDropdown');
        this.historyDropdownContent = document.getElementById('historyDropdownContent');
        this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
        
        // Variable pour suivre l'état du menu
        this.isHistoryDropdownVisible = false;

        // Gestionnaire pour le bouton d'effacement
        this.clearHistoryBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Empêcher la propagation du clic
            this.clearMediaHistory();
            this.renderHistoryDropdown();
        });

        // Gestionnaire pour afficher le menu déroulant au survol
        this.historyToggleBtn.addEventListener('mouseenter', () => {
            this.showHistoryDropdown();
        });
        
        // Gestionnaire pour le clic sur le bouton
        this.historyToggleBtn.addEventListener('click', () => {
            if (this.isHistoryDropdownVisible) {
                this.hideHistoryDropdown();
            } else {
                this.showHistoryDropdown();
            }
        });

        // Gestionnaire pour masquer le menu déroulant lorsque la souris quitte
        this.historyDropdown.addEventListener('mouseleave', () => {
            this.hideHistoryDropdown();
        });
        
        // Clic n'importe où sur le document pour fermer le dropdown
        document.addEventListener('click', (e) => {
            if (this.isHistoryDropdownVisible && 
                !this.historyDropdown.contains(e.target) && 
                e.target !== this.historyToggleBtn) {
                this.hideHistoryDropdown();
            }
        });

        // Initialiser l'affichage de l'historique
        this.renderHistoryDropdown();
    }
    
    // Afficher le menu déroulant
    showHistoryDropdown() {
        this.historyDropdown.style.opacity = '1';
        this.historyDropdown.style.visibility = 'visible';
        this.historyDropdown.style.transform = 'translateX(0)';
        this.historyToggleBtn.classList.add('active');
        this.isHistoryDropdownVisible = true;
    }
    
    // Masquer le menu déroulant
    hideHistoryDropdown() {
        this.historyDropdown.style.opacity = '0';
        this.historyDropdown.style.visibility = 'hidden';
        this.historyDropdown.style.transform = 'translateX(20px)';
        this.historyToggleBtn.classList.remove('active');
        this.isHistoryDropdownVisible = false;
    }

    renderHistoryDropdown() {
        if (!this.historyDropdownContent) return;

        const history = this.loadMediaHistory();
        if (!history || history.length === 0) {
            this.historyDropdownContent.innerHTML = '<div class="no-history">Aucun historique</div>';
            return;
        }

        const groupedHistory = this.groupHistoryByDate(history);
        let html = '';

        for (const [date, items] of Object.entries(groupedHistory)) {
            html += `<div class="history-date-header">${date}</div>`;
            
            items.forEach(item => {
                // Déterminer l'icône de source
                const sourceIcon = item.source === 'youtube' ? 'fa-youtube' : 
                                 item.source === 'spotify' ? 'fa-spotify' : 'fa-file-audio';
                
                // Déterminer la vignette
                let thumbnailUrl = '';
                if (item.source === 'youtube') {
                    thumbnailUrl = `https://i.ytimg.com/vi/${item.videoId}/default.jpg`;
                } else if (item.source === 'spotify') {
                    thumbnailUrl = item.image || 'https://via.placeholder.com/40?text=S';
                } else {
                    // Média local, utiliser une icône par défaut
                    if (item.type && item.type.startsWith('video/')) {
                        thumbnailUrl = 'https://cdn-icons-png.flaticon.com/512/2991/2991106.png';
                    } else {
                        thumbnailUrl = 'https://cdn-icons-png.flaticon.com/512/2995/2995101.png';
                    }
                }
                
                // Récupérer les bonnes propriétés pour le titre et l'artiste
                const title = item.title || item.name || 'Sans titre';
                const artist = item.artist || item.channelName || 
                               (item.artists ? item.artists.join(', ') : '');
                
                html += `
                    <div class="history-dropdown-item ${item.source}" onclick="mediaPlayer.playFromHistory(${JSON.stringify(item)})">
                        <div class="history-dropdown-thumbnail">
                            <img src="${thumbnailUrl}" alt="${title}">
                        </div>
                        <div class="history-dropdown-info">
                            <h4>${title}</h4>
                            <p>${artist}</p>
                            <div class="history-dropdown-source">
                                <i class="fab ${sourceIcon}"></i>
                                <span class="timestamp">${this.formatTimeAgo(new Date(item.timestamp))}</span>
                            </div>
                        </div>
                </div>
            `;
            });
        }

        this.historyDropdownContent.innerHTML = html;
    }

    // Charger l'historique des médias
    loadMediaHistory() {
        const saved = localStorage.getItem('mediaHistory');
        return saved ? JSON.parse(saved) : [];
    }
    
    // Sauvegarder l'historique des médias
    saveMediaHistory() {
        // Limiter à 20 éléments maximum
        if (this.mediaHistory.length > 20) {
            this.mediaHistory = this.mediaHistory.slice(0, 20);
        }
        localStorage.setItem('mediaHistory', JSON.stringify(this.mediaHistory));
    }
    
    // Ajouter un élément à l'historique
    addToHistory(item) {
        // Fonctionnalité d'historique désactivée
        console.log('Historique désactivé');
    }
    
    // Effacer l'historique des médias
    clearMediaHistory() {
        this.mediaHistory = [];
        this.saveMediaHistory();
        this.renderMediaHistory();
    }
    
    // Afficher/masquer l'historique
    toggleHistoryVisibility() {
        const taskbar = document.querySelector('.taskbar');
        taskbar.classList.toggle('collapsed');
    }
    
    // Afficher l'historique dans la barre des tâches
    renderMediaHistory() {
        const historyContainer = document.getElementById('mediaHistory');
        historyContainer.innerHTML = '';
        
        // Filtrer uniquement les fichiers locaux (ni YouTube ni Spotify)
        const localMediaHistory = this.mediaHistory.filter(item => 
            item.source !== 'youtube' && item.source !== 'spotify'
        );
        
        localMediaHistory.forEach(item => {
            const historyElement = document.createElement('div');
            historyElement.className = 'history-item local';
            
            // Média local, utiliser une icône par défaut
            let thumbnailUrl = '';
            if (item.type && item.type.startsWith('video/')) {
                thumbnailUrl = 'https://cdn-icons-png.flaticon.com/512/2991/2991106.png';
            } else {
                thumbnailUrl = 'https://cdn-icons-png.flaticon.com/512/2995/2995101.png';
            }
            
            historyElement.innerHTML = `
                <img src="${thumbnailUrl}" alt="${item.name || 'Media'}">
                <div class="item-title">${item.name || 'Sans titre'}</div>
            `;
            
            // Ajouter un gestionnaire d'événements pour jouer le média
            historyElement.addEventListener('click', () => {
                this.playFromHistory(item);
            });
            
            historyContainer.appendChild(historyElement);
        });
    }
    
    // Jouer un média depuis l'historique
    playFromHistory(item) {
        console.log('Lecture depuis l\'historique:', item);
        
        // Ne pas appeler stopSpotifyPlayback pour maintenir la configuration Spotify
        
        if (item.source === 'youtube') {
            // Passer au mode YouTube et jouer la vidéo
            document.querySelector('.mode-btn[data-mode="youtube"]').click();
            
            // Définir le type de recherche approprié (music/video)
            document.getElementById('searchType').value = item.isMusic ? 'music' : 'video';
            
            // Attendre un peu pour s'assurer que le mode est bien changé
            setTimeout(() => {
                this.playYouTubeVideo(item.videoId, {
                    title: item.title || item.name || 'YouTube Video',
                    channelTitle: item.channelName || item.artist || 'YouTube'
                });
            }, 100);
        } else if (item.source === 'spotify') {
            // Passer au mode Spotify et jouer la piste
            document.querySelector('.mode-btn[data-mode="spotify"]').click();
            
            // Attendre un peu pour s'assurer que le mode est bien changé
            setTimeout(() => {
                if (item.uri) {
                    this.playSpotifyTrack({
                        uri: item.uri,
                        name: item.title || item.name,
                        artists: item.artists || [{ name: item.artist || 'Artiste inconnu' }],
                        album: { 
                            images: item.image ? [{ url: item.image }] : [] 
                        },
                        external_urls: { 
                            spotify: item.external_url || `https://open.spotify.com/track/${item.uri.split(':').pop()}` 
                        },
                        preview_url: item.preview_url
                    });
                } else if (item.preview_url) {
                    this.playSpotifyPreview({
                        name: item.title || item.name,
                        artists: item.artists || [{ name: item.artist || 'Artiste inconnu' }],
                        album: { 
                            images: item.image ? [{ url: item.image }] : [] 
                        },
                        preview_url: item.preview_url,
                        external_urls: { 
                            spotify: item.external_url || '#' 
                        }
                    });
                }
            }, 100);
        } else {
            // Média local
            const mediaItem = this.library.find(media => media.id === item.id);
            if (mediaItem) {
                document.querySelector('.mode-btn[data-mode="local"]').click();
                setTimeout(() => {
                    this.playMedia(mediaItem);
                }, 100);
            } else {
                console.error("Ce média n'est plus disponible dans la bibliothèque locale");
                // Afficher une notification
                const errorElement = document.createElement('div');
                errorElement.className = 'spotify-error-notification';
                errorElement.innerHTML = `
                    <p>Ce média n'est plus disponible</p>
                    <small>Le fichier a peut-être été supprimé de la bibliothèque</small>
                `;
                
                document.body.appendChild(errorElement);
                
                // Supprimer après 5 secondes
                setTimeout(() => {
                    errorElement.classList.add('fade-out');
                    setTimeout(() => {
                        document.body.removeChild(errorElement);
                    }, 500);
                }, 5000);
            }
        }
    }

    // Afficher l'historique dans la barre latérale
    renderFullHistorySidebar() {
        const sidebarContent = document.getElementById('historySidebarContent');
        sidebarContent.innerHTML = '';
        
        // Filtrer uniquement les fichiers locaux (ni YouTube ni Spotify)
        const localMediaHistory = this.mediaHistory.filter(item => 
            item.source !== 'youtube' && item.source !== 'spotify'
        );
        
        if (localMediaHistory.length === 0) {
            sidebarContent.innerHTML = '<div class="no-history">Aucun fichier local dans l\'historique</div>';
            return;
        }
        
        // Grouper les éléments par date
        const groupedHistory = this.groupHistoryByDate(localMediaHistory);
        
        // Parcourir chaque jour et afficher les éléments
        for (const [date, items] of Object.entries(groupedHistory)) {
            // Créer un en-tête pour la date
            const dateHeader = document.createElement('div');
            dateHeader.className = 'history-date-header';
            dateHeader.textContent = date;
            sidebarContent.appendChild(dateHeader);
            
            // Ajouter les éléments pour cette date
            items.forEach(item => {
                const historyElement = document.createElement('div');
                historyElement.className = 'history-sidebar-item local';
                
                // Récupérer l'image en fonction du type
                let thumbnailUrl = '';
                let sourceIcon = '';
                
                // Média local, utiliser une icône par défaut
                if (item.type && item.type.startsWith('video/')) {
                    thumbnailUrl = 'https://cdn-icons-png.flaticon.com/512/2991/2991106.png';
                    sourceIcon = '<i class="fas fa-file-video"></i>';
                } else {
                    thumbnailUrl = 'https://cdn-icons-png.flaticon.com/512/2995/2995101.png';
                    sourceIcon = '<i class="fas fa-file-audio"></i>';
                }
                
                // Timestamp de l'élément
                const timestamp = item.timestamp ? this.formatTimeAgo(new Date(item.timestamp)) : "À l'instant";
                
                historyElement.innerHTML = `
                    <div class="history-sidebar-thumbnail">
                        <img src="${thumbnailUrl}" alt="${item.name || 'Media'}">
                    </div>
                    <div class="history-sidebar-info">
                        <h4>${item.name || 'Sans titre'}</h4>
                        <p>Fichier local</p>
                        <div class="history-sidebar-source">
                            ${sourceIcon}
                            <span>Local</span>
                            <span class="timestamp">${timestamp}</span>
                        </div>
                    </div>
                `;
                
                // Ajouter un gestionnaire d'événements pour jouer le média
                historyElement.addEventListener('click', () => {
                    this.playFromHistory(item);
                });
                
                sidebarContent.appendChild(historyElement);
            });
        }
    }

    // Grouper les éléments de l'historique par date
    groupHistoryByDate(history) {
        const grouped = {};
        
        history.forEach(item => {
            // Utiliser le timestamp de l'élément s'il existe, sinon la date actuelle
            let date;
            if (item.timestamp) {
                date = new Date(item.timestamp);
            } else {
                date = new Date();
            }
            
            const dateStr = this.formatDate(date);
            
            if (!grouped[dateStr]) {
                grouped[dateStr] = [];
            }
            
            grouped[dateStr].push(item);
        });
        
        return grouped;
    }

    // Formater une date (aujourd'hui, hier, ou date complète)
    formatDate(date) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            return 'Aujourd\'hui';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Hier';
        } else {
            return date.toLocaleDateString('fr-FR', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long'
            });
        }
    }

    // Formater un temps relatif (il y a X minutes/heures)
    formatTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMin = Math.round(diffMs / 60000);
        
        if (diffMin < 1) {
            return 'À l\'instant';
        } else if (diffMin < 60) {
            return `Il y a ${diffMin} min`;
        } else {
            const diffHours = Math.floor(diffMin / 60);
            if (diffHours < 24) {
                return `Il y a ${diffHours}h`;
            } else {
                const diffDays = Math.floor(diffHours / 24);
                return `Il y a ${diffDays}j`;
            }
        }
    }

    // Afficher/masquer la barre latérale d'historique
    toggleHistorySidebar() {
        const sidebar = document.querySelector('.history-sidebar');
        const button = document.getElementById('toggleHistorySidebarBtn');
        
        sidebar.classList.toggle('hidden');
        button.classList.toggle('active');
        
        // Mettre à jour l'historique à chaque ouverture
        if (!sidebar.classList.contains('hidden')) {
            this.renderFullHistorySidebar();
        }
    }
    
    stopSpotifyPlayback() {
        console.log('⚠️ ARRÊT COMPLET de tous les lecteurs Spotify');
        
        // 1. Arrêter et supprimer l'audio de prévisualisation
        if (this.previewPlayer) {
            console.log('- Arrêt du lecteur de prévisualisation');
            this.previewPlayer.pause();
            this.previewPlayer.currentTime = 0;
            this.previewPlayer.src = '';  // Supprimer la source
            this.previewPlayer.load();    // Forcer le rechargement
            this.previewPlayer.style.display = 'none';
        }
        
        // 2. Supprimer complètement l'iframe Spotify Embed
        if (this.spotifyEmbedPlayer) {
            console.log('- Suppression du lecteur Spotify Embed');
            this.spotifyEmbedPlayer.src = 'about:blank';  // Vider l'iframe
            this.spotifyEmbedPlayer.style.display = 'none';
            
            // Re-création de l'iframe pour s'assurer qu'il n'y a pas de lecteur actif
            if (this.spotifyEmbedPlayer.parentNode) {
                const parent = this.spotifyEmbedPlayer.parentNode;
                parent.removeChild(this.spotifyEmbedPlayer);
                
                // Recréer une nouvelle iframe vide
                this.spotifyEmbedPlayer = document.createElement('iframe');
                this.spotifyEmbedPlayer.style.width = '100%';
                this.spotifyEmbedPlayer.style.height = '80px';
                this.spotifyEmbedPlayer.style.border = 'none';
                this.spotifyEmbedPlayer.style.borderRadius = '8px';
                this.spotifyEmbedPlayer.style.display = 'none';
                parent.appendChild(this.spotifyEmbedPlayer);
            }
        }
        
        // 3. Arrêter via le SDK Spotify
        if (this.spotifyPlayer) {
            console.log('- Pause via SDK Spotify');
            // Essayer plusieurs méthodes pour s'assurer que tout est arrêté
            try {
                this.spotifyPlayer.pause();
                
                // Tentative pour déconnecter complètement le SDK
                if (typeof this.spotifyPlayer.disconnect === 'function') {
                    this.spotifyPlayer.disconnect();
                }
            } catch (e) {
                console.error('Erreur lors de la pause du SDK Spotify:', e);
            }
        }
        
        // 4. Arrêter via l'API Spotify
        if (this.spotifyDeviceId) {
            console.log('- Requête de pause via API Spotify');
            const token = localStorage.getItem('spotify_token');
            
            if (token) {
                // Tentative de pause via l'API
                fetch('https://api.spotify.com/v1/me/player/pause', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }).catch(e => console.error('Erreur API Spotify (pause):', e));
                
                // Tentative de transfert de lecture vers un autre appareil (astuce pour stopper)
                fetch('https://api.spotify.com/v1/me/player', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        device_ids: ['1234567890'], // ID invalide pour forcer un arrêt
                        play: false
                    })
                }).catch(e => console.error('Erreur API Spotify (transfert):', e));
            }
        }
        
        // 5. Masquer tous les contrôles Spotify
        if (this.spotifyControls) {
            this.spotifyControls.style.display = 'none';
        }
        
        // 6. Nettoyage supplémentaire
        document.querySelectorAll('iframe[src*="spotify"]').forEach(iframe => {
            console.log('- Nettoyage d\'iframe Spotify supplémentaire');
            iframe.src = 'about:blank';
        });
        
        console.log('Tous les lecteurs Spotify devraient être arrêtés.');
    }

    // Charger la bibliothèque locale depuis le serveur
    async loadLibraryFromServer() {
        try {
            const response = await fetch('/api/media');
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const allMedia = await response.json();
            
            // Transformer les résultats en format compatible avec notre bibliothèque
            const formattedMedia = [];
            
            // Ajouter les fichiers audio
            if (allMedia.audio && allMedia.audio.length > 0) {
                allMedia.audio.forEach(item => {
                    formattedMedia.push({
                        id: `audio-${item.name}`,
                        name: item.name,
                        path: item.path,
                        type: 'audio/mp3', // À ajuster en fonction de l'extension réelle
                        source: 'local',
                        added: item.lastModified,
                        size: item.size
                    });
                });
            }
            
            // Ajouter les fichiers vidéo
            if (allMedia.video && allMedia.video.length > 0) {
                allMedia.video.forEach(item => {
                    formattedMedia.push({
                        id: `video-${item.name}`,
                        name: item.name,
                        path: item.path,
                        type: 'video/mp4', // À ajuster en fonction de l'extension réelle
                        source: 'local',
                        added: item.lastModified,
                        size: item.size
                    });
                });
            }
            
            // Ajouter les images
            if (allMedia.images && allMedia.images.length > 0) {
                allMedia.images.forEach(item => {
                    formattedMedia.push({
                        id: `image-${item.name}`,
                        name: item.name,
                        path: item.path,
                        type: 'image/jpeg', // À ajuster en fonction de l'extension réelle
                        source: 'local',
                        added: item.lastModified,
                        size: item.size
                    });
                });
            }
            
            // Ajouter les fichiers du serveur à la bibliothèque existante
            // en vérifiant s'ils n'existent pas déjà (par le nom)
            formattedMedia.forEach(mediaItem => {
                // Vérifier si le média existe déjà (par son nom)
                const exists = this.library.some(item => 
                    item.name === mediaItem.name && 
                    (item.path === mediaItem.path || (item.type && mediaItem.type && item.type.split('/')[0] === mediaItem.type.split('/')[0]))
                );
                
                if (!exists) {
                    this.library.unshift(mediaItem);
                }
            });
            
            // Sauvegarder et mettre à jour l'interface
            this.saveLibrary();
            this.renderLibrary();
            
            console.log(`Bibliothèque mise à jour depuis le serveur: ${formattedMedia.length} fichiers trouvés`);
        } catch (error) {
            console.error('Erreur lors du chargement des médias depuis le serveur:', error);
        }
    }
    
    // Lire un fichier audio
    playAudioFile(mediaItem) {
        console.log('Lecture audio:', mediaItem);
        const audioPlayer = document.getElementById('audioPlayer');
        const mediaPlayer = document.getElementById('mediaPlayer');
        
        // Masquer le lecteur vidéo
        mediaPlayer.classList.remove('active');
        mediaPlayer.innerHTML = '';
        
        // Afficher le lecteur audio
        audioPlayer.style.display = 'block';
        
        // Déterminer la source audio
        if (mediaItem.path) {
            audioPlayer.src = mediaItem.path;
        } else if (mediaItem.blob) {
            audioPlayer.src = mediaItem.blob;
        } else {
            console.error('Aucune source audio disponible');
            return;
        }
        
        // Jouer l'audio et gérer les erreurs
        audioPlayer.play().catch(error => {
            console.error('Erreur lors de la lecture audio:', error);
            alert('Impossible de lire le fichier audio. Format non supporté ou fichier corrompu.');
        });
        
        // Mettre à jour la vignette
        const mediaThumbnail = document.getElementById('mediaThumbnail');
        mediaThumbnail.innerHTML = '<i class="fas fa-music"></i>';
    }
    
    // Lire un fichier vidéo
    playVideoFile(mediaItem) {
        console.log('Tentative de lecture vidéo:', mediaItem);
        console.log('Type MIME de la vidéo:', mediaItem.type);
        
        const audioPlayer = document.getElementById('audioPlayer');
        const mediaPlayer = document.getElementById('mediaPlayer');
        
        // Masquer le lecteur audio
        audioPlayer.style.display = 'none';
        audioPlayer.pause();
        audioPlayer.src = '';
        
        // Afficher le conteneur vidéo
        mediaPlayer.classList.add('active');
        
        // Déterminer la source vidéo et créer l'élément vidéo
        mediaPlayer.innerHTML = '<video controls width="100%" id="videoElement"></video>';
        const videoElement = document.getElementById('videoElement');
        
        if (!videoElement) {
            console.error("Impossible de créer l'élément vidéo");
            return;
        }
        
        // Ajouter des logs détaillés pour les événements vidéo
        videoElement.addEventListener('loadstart', () => console.log('Vidéo: loadstart'));
        videoElement.addEventListener('durationchange', () => console.log('Vidéo: durationchange, durée =', videoElement.duration));
        videoElement.addEventListener('loadedmetadata', () => console.log('Vidéo: loadedmetadata'));
        videoElement.addEventListener('loadeddata', () => console.log('Vidéo: loadeddata'));
        videoElement.addEventListener('progress', () => console.log('Vidéo: progress'));
        videoElement.addEventListener('canplay', () => console.log('Vidéo: canplay - prête à être lue'));
        videoElement.addEventListener('canplaythrough', () => console.log('Vidéo: canplaythrough - lecture sans interruption possible'));
        
        // Gestion des erreurs
        videoElement.addEventListener('error', (e) => {
            console.error('Erreur vidéo:', videoElement.error);
            if (videoElement.error) {
                console.error('Code:', videoElement.error.code);
                console.error('Message:', videoElement.error.message);
                
                let errorMessage = 'Impossible de lire cette vidéo.';
                
                // Messages d'erreur spécifiques selon le code d'erreur
                switch(videoElement.error.code) {
                    case 1: // MEDIA_ERR_ABORTED
                        errorMessage = 'La lecture vidéo a été interrompue.';
                        break;
                    case 2: // MEDIA_ERR_NETWORK
                        errorMessage = 'Une erreur réseau a interrompu la lecture vidéo.';
                        break;
                    case 3: // MEDIA_ERR_DECODE
                        errorMessage = 'Le navigateur ne peut pas décoder ce format vidéo.';
                        break;
                    case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
                        errorMessage = 'Ce format vidéo n\'est pas supporté par le navigateur.';
                        break;
                }
                
                mediaPlayer.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${errorMessage}</p>
                        <p>Détails: ${videoElement.error.message || 'Aucun détail disponible'}</p>
                    </div>
                `;
            }
        });
        
        // Assigner la source vidéo
        try {
            if (mediaItem.path) {
                console.log('Utilisation du chemin de fichier pour la vidéo:', mediaItem.path);
                videoElement.src = mediaItem.path;
            } else if (mediaItem.blob) {
                console.log('Utilisation du blob pour la vidéo, début:', mediaItem.blob.substring(0, 50));
                
                // Vérifier si le blob est une URL de données valide pour la vidéo
                if (mediaItem.blob.startsWith('data:video/') || 
                    mediaItem.blob.startsWith('data:application/octet-stream')) {
                    videoElement.src = mediaItem.blob;
                } else {
                    console.warn('Le format du blob ne semble pas correct pour une vidéo');
                    // Tenter de l'utiliser quand même
                    videoElement.src = mediaItem.blob;
                }
            } else {
                throw new Error('Aucune source vidéo disponible');
            }
            
            // Tenter la lecture automatique (peut échouer en raison des restrictions du navigateur)
            videoElement.play()
                .then(() => console.log('Lecture vidéo démarrée avec succès'))
                .catch(err => {
                    console.warn('Lecture automatique impossible:', err);
                    console.log('L\'utilisateur devra cliquer sur le bouton de lecture');
                });
                
        } catch (error) {
            console.error('Erreur lors de la configuration de la vidéo:', error);
            mediaPlayer.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erreur lors de la lecture vidéo: ${error.message}</p>
                </div>
            `;
        }
        
        // Mettre à jour la vignette
        const mediaThumbnail = document.getElementById('mediaThumbnail');
        mediaThumbnail.innerHTML = '<i class="fas fa-film"></i>';
    }
    
    // Supprimer une playlist
    deletePlaylist(playlistId) {
        // Si c'est la playlist en cours, arrêter la lecture
        if (this.currentPlaylist && this.currentPlaylist.id === playlistId) {
            // Masquer les contrôles et l'indicateur de playlist
            const playingFromPlaylist = document.getElementById('playingFromPlaylist');
            const mediaControls = document.getElementById('mediaControls');
            
            if (playingFromPlaylist) {
                playingFromPlaylist.style.display = 'none';
            }
            
            if (mediaControls) {
                mediaControls.style.display = 'none';
            }
            
            this.currentPlaylist = null;
            this.currentPlaylistIndex = -1;
        }
        
        // Supprimer la playlist
        this.playlists = this.playlists.filter(p => p.id !== playlistId);
        this.savePlaylists();
        
        // Mettre à jour l'affichage
        this.renderPlaylists();
    }
    
    // Initialiser les contrôles de lecture pour les playlists
    initializeMediaControls() {
        const prevButton = document.getElementById('prevButton');
        const playPauseButton = document.getElementById('playPauseButton');
        const nextButton = document.getElementById('nextButton');
        
        if (prevButton) {
            prevButton.addEventListener('click', () => {
                this.playPreviousInPlaylist();
            });
        }
        
        if (nextButton) {
            nextButton.addEventListener('click', () => {
                this.playNextInPlaylist();
            });
        }
        
        if (playPauseButton) {
            playPauseButton.addEventListener('click', () => {
                this.togglePlayPause();
            });
        }
        
        // Mettre à jour l'état des boutons lors de la lecture/pause audio
        const audioPlayer = document.getElementById('audioPlayer');
        if (audioPlayer) {
            audioPlayer.addEventListener('play', () => {
                this.updatePlayPauseButton(true);
            });
            
            audioPlayer.addEventListener('pause', () => {
                this.updatePlayPauseButton(false);
            });
        }
    }
    
    // Mettre à jour le bouton play/pause
    updatePlayPauseButton(isPlaying) {
        const playPauseButton = document.getElementById('playPauseButton');
        if (playPauseButton) {
            const icon = playPauseButton.querySelector('i');
            if (isPlaying) {
                icon.className = 'fas fa-pause';
            } else {
                icon.className = 'fas fa-play';
            }
        }
    }
    
    // Basculer lecture/pause
    togglePlayPause() {
        const audioPlayer = document.getElementById('audioPlayer');
        const videoPlayer = document.querySelector('#mediaPlayer video');
        
        if (audioPlayer && audioPlayer.style.display !== 'none') {
            if (audioPlayer.paused) {
                audioPlayer.play();
            } else {
                audioPlayer.pause();
            }
        } else if (videoPlayer) {
            if (videoPlayer.paused) {
                videoPlayer.play();
            } else {
                videoPlayer.pause();
            }
        }
    }

    // Afficher une image
    displayImage(mediaItem) {
        console.log('Affichage image:', mediaItem);
        const audioPlayer = document.getElementById('audioPlayer');
        const mediaPlayer = document.getElementById('mediaPlayer');
        
        // Masquer le lecteur audio
        audioPlayer.style.display = 'none';
        audioPlayer.pause();
        audioPlayer.src = '';
        
        // Déterminer la source de l'image
        let imageSource;
        if (mediaItem.path) {
            imageSource = mediaItem.path;
        } else if (mediaItem.blob) {
            imageSource = mediaItem.blob;
        } else {
            console.error('Aucune source d\'image disponible');
            mediaPlayer.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Source d'image non disponible.</p>
                </div>
            `;
            return;
        }
        
        // Afficher l'image dans un canvas pour permettre des modifications ultérieures
        mediaPlayer.classList.add('active');
        mediaPlayer.innerHTML = `
            <div class="image-container">
                <canvas id="imageCanvas" width="800" height="600"></canvas>
                <div class="image-controls">
                    <button id="rotateLeftBtn" class="image-btn"><i class="fas fa-undo"></i></button>
                    <button id="rotateRightBtn" class="image-btn"><i class="fas fa-redo"></i></button>
                    <button id="zoomInBtn" class="image-btn"><i class="fas fa-search-plus"></i></button>
                    <button id="zoomOutBtn" class="image-btn"><i class="fas fa-search-minus"></i></button>
                    <button id="resetImageBtn" class="image-btn"><i class="fas fa-sync"></i></button>
                    <select id="imageFilter" class="image-filter">
                        <option value="none">Normal</option>
                        <option value="grayscale">Noir et blanc</option>
                        <option value="sepia">Sépia</option>
                        <option value="invert">Inverser</option>
                        <option value="blur">Flou</option>
                        <option value="brightness">Luminosité +</option>
                        <option value="contrast">Contraste +</option>
                    </select>
                </div>
            </div>
        `;
        
        // Initialiser le canvas avec l'image
        const img = new Image();
        img.onload = () => {
            const canvas = document.getElementById('imageCanvas');
            const ctx = canvas.getContext('2d');
            
            // Adapter les dimensions du canvas à l'image
            const aspectRatio = img.width / img.height;
            let canvasWidth = canvas.width;
            let canvasHeight = canvasWidth / aspectRatio;
            
            if (canvasHeight > 600) {
                canvasHeight = 600;
                canvasWidth = canvasHeight * aspectRatio;
            }
            
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            
            // Dessiner l'image
            ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
            
            // Initialiser les contrôles d'image
            this.initImageControls(img, canvas, ctx);
        };
        
        // Gestion d'erreur pour le chargement de l'image
        img.onerror = () => {
            console.error('Erreur lors du chargement de l\'image');
            mediaPlayer.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Impossible d'afficher cette image. Format non supporté ou fichier corrompu.</p>
                </div>
            `;
        };
        
        img.src = imageSource;
        
        // Mettre à jour la vignette
        const mediaThumbnail = document.getElementById('mediaThumbnail');
        mediaThumbnail.innerHTML = '<i class="fas fa-image"></i>';
    }

    // Initialiser les contrôles pour l'édition d'images
    initImageControls(img, canvas, ctx) {
        const rotateLeftBtn = document.getElementById('rotateLeftBtn');
        const rotateRightBtn = document.getElementById('rotateRightBtn');
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const resetImageBtn = document.getElementById('resetImageBtn');
        const imageFilter = document.getElementById('imageFilter');
        
        let rotation = 0;
        let zoom = 1;
        let currentFilter = 'none';
        
        // Fonction pour redessiner l'image
        const redrawImage = () => {
            // Effacer le canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Sauvegarder le contexte
            ctx.save();
            
            // Appliquer les transformations
            ctx.translate(canvas.width/2, canvas.height/2);
            ctx.rotate(rotation * Math.PI / 180);
            ctx.scale(zoom, zoom);
            ctx.translate(-canvas.width/2, -canvas.height/2);
            
            // Dessiner l'image
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Appliquer les filtres
            if (currentFilter !== 'none') {
                let filterValue = '';
                
                switch (currentFilter) {
                    case 'grayscale':
                        filterValue = 'grayscale(100%)';
                        break;
                    case 'sepia':
                        filterValue = 'sepia(100%)';
                        break;
                    case 'invert':
                        filterValue = 'invert(100%)';
                        break;
                    case 'blur':
                        filterValue = 'blur(5px)';
                        break;
                    case 'brightness':
                        filterValue = 'brightness(150%)';
                        break;
                    case 'contrast':
                        filterValue = 'contrast(150%)';
                        break;
                }
                
                if (filterValue) {
                    ctx.filter = filterValue;
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    ctx.filter = 'none';
                }
            }
            
            // Restaurer le contexte
            ctx.restore();
        };
        
        // Rotation à gauche
        if (rotateLeftBtn) {
            rotateLeftBtn.addEventListener('click', () => {
                rotation -= 90;
                redrawImage();
            });
        }
        
        // Rotation à droite
        if (rotateRightBtn) {
            rotateRightBtn.addEventListener('click', () => {
                rotation += 90;
                redrawImage();
            });
        }
        
        // Zoom avant
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                zoom *= 1.2;
                redrawImage();
            });
        }
        
        // Zoom arrière
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                zoom /= 1.2;
                redrawImage();
            });
        }
        
        // Réinitialiser
        if (resetImageBtn) {
            resetImageBtn.addEventListener('click', () => {
                rotation = 0;
                zoom = 1;
                currentFilter = 'none';
                if (imageFilter) imageFilter.value = 'none';
                redrawImage();
            });
        }
        
        // Appliquer un filtre
        if (imageFilter) {
            imageFilter.addEventListener('change', () => {
                currentFilter = imageFilter.value;
                redrawImage();
            });
        }
    }

    // Méthode pour réinitialiser complètement la bibliothèque
    resetLibrary() {
        console.log("Réinitialisation de la bibliothèque...");
        try {
            localStorage.removeItem('mediaLibrary');
            localStorage.removeItem('mediaPlaylists');
            this.library = [];
            this.playlists = [];
            this.currentMedia = null;
            this.currentPlaylist = null;
            this.currentPlaylistIndex = -1;
            
            // Réinitialiser l'interface
            this.renderLibrary();
            this.renderPlaylist();
            this.renderPlaylists();
            
            // Masquer les contrôles de lecture
            const mediaControls = document.getElementById('mediaControls');
            const playingFromPlaylist = document.getElementById('playingFromPlaylist');
            if (mediaControls) mediaControls.style.display = 'none';
            if (playingFromPlaylist) playingFromPlaylist.style.display = 'none';
            
            // Réinitialiser le titre et le type
            document.getElementById('mediaTitle').textContent = 'Aucun fichier sélectionné';
            document.getElementById('mediaType').textContent = '';
            
            // Cacher le lecteur vidéo
            const mediaPlayer = document.getElementById('mediaPlayer');
            if (mediaPlayer) {
                mediaPlayer.classList.remove('active');
                mediaPlayer.innerHTML = '';
            }
            
            // Cacher le lecteur audio
            const audioPlayer = document.getElementById('audioPlayer');
            if (audioPlayer) {
                audioPlayer.style.display = 'none';
                audioPlayer.src = '';
            }
            
            // Réinitialiser la vignette
            const mediaThumbnail = document.getElementById('mediaThumbnail');
            if (mediaThumbnail) {
                mediaThumbnail.innerHTML = '<i class="fas fa-music"></i>';
            }
            
            alert('La bibliothèque a été réinitialisée avec succès.');
            console.log("Bibliothèque réinitialisée avec succès");
        } catch (error) {
            console.error("Erreur lors de la réinitialisation de la bibliothèque:", error);
            alert("Erreur lors de la réinitialisation: " + error.message);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MediaPlayer();
}); 

