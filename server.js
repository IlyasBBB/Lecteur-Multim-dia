import express from 'express';
import cors from 'cors';
import querystring from 'querystring';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Spotify configuration
const CLIENT_ID = '4d47bfe9edfb494bba242c1739f65595';
const CLIENT_SECRET = 'dd54c9510c5d4d9da0336ea76dc54afc';
const REDIRECT_URI = 'http://localhost:8000/callback';

const scope = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-library-read',
    'user-library-modify',
    'user-read-playback-state',
    'user-modify-playback-state',
    'app-remote-control',
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-modify-private'
].join(' ');

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    console.log('Demande de connexion Spotify reçue');
    const authUrl = 'https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: CLIENT_ID,
            scope: scope,
            redirect_uri: REDIRECT_URI,
            show_dialog: true
        });
    console.log('Redirection vers Spotify:', authUrl);
    res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
    console.log('Callback Spotify reçu');
    const code = req.query.code || null;
    const error = req.query.error || null;
    
    if (error) {
        console.error('Erreur pendant l\'authentification Spotify:', error);
        return res.status(400).send(`Authentication error: ${error}`);
    }
    
    if (!code) {
        console.error('Code d\'autorisation manquant');
        return res.status(400).send('Authorization code missing');
    }

    try {
        console.log('Code d\'autorisation reçu, échange en cours...');

        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI
            }).toString()
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error('Échec de l\'échange de token:', {
                status: tokenResponse.status,
                statusText: tokenResponse.statusText,
                error: errorData
            });
            throw new Error(`HTTP error! status: ${tokenResponse.status}`);
        }

        const data = await tokenResponse.json();
        console.log('Échange de token réussi, tokens générés');

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Spotify Auth Complete</title>
            </head>
            <body>
                <script>
                    if (window.opener) {
                        window.opener.postMessage({
                            access_token: '${data.access_token}',
                            refresh_token: '${data.refresh_token}'
                        }, '*');
                        document.body.innerHTML = 'Authentification réussie. Cette fenêtre va se fermer automatiquement.';
                    } else {
                        document.body.innerHTML = 'Authentification réussie. Vous pouvez fermer cette fenêtre.';
                    }
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Erreur détaillée pendant l\'authentification Spotify:', error);
        res.status(500).send('Authentication failed: ' + error.message);
    }
});

app.get('/refresh_token', async (req, res) => {
    console.log('Demande de rafraîchissement de token reçue');
    const refresh_token = req.query.refresh_token;
    
    if (!refresh_token) {
        console.error('Refresh token manquant');
        return res.status(400).send('Missing refresh token');
    }
    
    try {
        console.log('Tentative de rafraîchissement avec le token:', refresh_token.substring(0, 5) + '...');
        
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: querystring.stringify({
                grant_type: 'refresh_token',
                refresh_token: refresh_token
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Échec du rafraîchissement:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            });
            return res.status(response.status).send('Error refreshing token: ' + errorText);
        }

        const data = await response.json();
        console.log('Token rafraîchi avec succès');
        res.json(data);
    } catch (error) {
        console.error('Erreur lors du rafraîchissement du token:', error);
        res.status(500).send('Error refreshing token: ' + error.message);
    }
});

// Créer le dossier des médias s'il n'existe pas
const mediaDirs = {
    audio: path.join(__dirname, 'media/audio'),
    video: path.join(__dirname, 'media/video'),
    images: path.join(__dirname, 'media/images')
};

// Assurer que les répertoires existent
Object.values(mediaDirs).forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Servir les fichiers médias
app.use('/media', express.static(path.join(__dirname, 'media')));

// API pour obtenir la liste des fichiers médias par type
app.get('/api/media/:type', (req, res) => {
    const { type } = req.params;
    const validTypes = ['audio', 'video', 'images'];
    
    if (!validTypes.includes(type)) {
        return res.status(400).json({ error: 'Type de média invalide' });
    }
    
    const mediaDir = mediaDirs[type];
    
    fs.readdir(mediaDir, (err, files) => {
        if (err) {
            console.error('Erreur de lecture du répertoire:', err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }
        
        const mediaFiles = files
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                if (type === 'audio') return ['.mp3', '.wav', '.ogg', '.aac'].includes(ext);
                if (type === 'video') return ['.mp4', '.webm', '.ogv'].includes(ext);
                if (type === 'images') return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
                return false;
            })
            .map(file => {
                const filePath = path.join(mediaDir, file);
                const stats = fs.statSync(filePath);
                
                return {
                    name: file,
                    path: `/media/${type}/${file}`,
                    size: stats.size,
                    lastModified: stats.mtime,
                    type: type
                };
            });
        
        res.json(mediaFiles);
    });
});

// API pour obtenir tous les médias
app.get('/api/media', (req, res) => {
    const allMedia = {};
    const validTypes = ['audio', 'video', 'images'];
    let completed = 0;
    
    validTypes.forEach(type => {
        const mediaDir = mediaDirs[type];
        
        fs.readdir(mediaDir, (err, files) => {
            if (err) {
                console.error(`Erreur de lecture du répertoire ${type}:`, err);
                allMedia[type] = [];
            } else {
                allMedia[type] = files
                    .filter(file => {
                        const ext = path.extname(file).toLowerCase();
                        if (type === 'audio') return ['.mp3', '.wav', '.ogg', '.aac'].includes(ext);
                        if (type === 'video') return ['.mp4', '.webm', '.ogv'].includes(ext);
                        if (type === 'images') return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
                        return false;
                    })
                    .map(file => {
                        const filePath = path.join(mediaDir, file);
                        const stats = fs.statSync(filePath);
                        
                        return {
                            name: file,
                            path: `/media/${type}/${file}`,
                            size: stats.size,
                            lastModified: stats.mtime,
                            type: type
                        };
                    });
            }
            
            completed++;
            if (completed === validTypes.length) {
                res.json(allMedia);
            }
        });
    });
});

// API pour obtenir les détails d'un fichier spécifique
app.get('/api/media/:type/:filename', (req, res) => {
    const { type, filename } = req.params;
    const validTypes = ['audio', 'video', 'images'];
    
    if (!validTypes.includes(type)) {
        return res.status(400).json({ error: 'Type de média invalide' });
    }
    
    const filePath = path.join(mediaDirs[type], filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Fichier non trouvé' });
    }
    
    const stats = fs.statSync(filePath);
    
    const fileDetails = {
        name: filename,
        path: `/media/${type}/${filename}`,
        size: stats.size,
        lastModified: stats.mtime,
        type: type
    };
    
    res.json(fileDetails);
});

// Handle 404 errors
app.use((req, res) => {
    res.status(404).send('404 - Page non trouvée');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Static files served from: ${path.join(__dirname, 'public')}`);
    console.log(`Répertoires médias:`);
    console.log(`- Audio: ${mediaDirs.audio}`);
    console.log(`- Vidéo: ${mediaDirs.video}`);
    console.log(`- Images: ${mediaDirs.images}`);
});