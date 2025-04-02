# Lecteur Multimédia - École Centrale de Lyon - Ilyas BEN ALLA - Ayoub ASSEFFAR

Un lecteur multimédia complet capable de lire des fichiers audio, vidéo et des images avec des fonctionnalités avancées.

## Fonctionnalités

- **Lecture de médias locaux** : Audio, vidéo et images
- **Édition d'images** : Rotation, zoom, filtres via Canvas
- **Création de playlists** : Organisez vos médias en listes de lecture personnalisées
- **Lecture automatique** : Enchaînement automatique des médias dans une playlist
- **API REST** : Accès aux médias via une API JSON
- **Interface ergonomique** : Design moderne et adaptatif

## Prérequis

- Node.js (v14.0.0 ou supérieur)
- npm (v6.0.0 ou supérieur)

## Installation

1. Clonez ce dépôt :
   ```
   git clone <https://github.com/IlyasBBB/Lecteur-Multim-dia.git>
   cd media-player-ecl
   ```

2. Installez les dépendances :
   ```
   npm install
   ```

3. Démarrez le serveur :
   ```
   npm start
   ```

4. Accédez à l'application dans votre navigateur :
   ```
   http://localhost:3000
   ```

## Structure du projet

- `public/` : Contient l'application front-end (HTML, CSS, JS)
- `media/` : Répertoire où sont stockés les fichiers médias (créé automatiquement)
  - `audio/` : Fichiers audio
  - `video/` : Fichiers vidéo
  - `images/` : Images
- `server.js` : Serveur Express qui fournit l'API et les fichiers statiques

## API REST

L'application expose une API REST pour accéder aux médias :

- `GET /api/media` : Récupère tous les médias disponibles
- `GET /api/media/:type` : Récupère les médias par type (audio, video, images)
- `GET /api/media/:type/:filename` : Récupère les détails d'un média spécifique

## Utilisation

### Ajout de médias

1. Cliquez sur "Ajouter des fichiers" ou glissez-déposez des fichiers dans la zone d'upload
2. Les fichiers sont automatiquement triés et ajoutés à la bibliothèque en fonction de leur type

### Lecture de médias

- Cliquez sur un média dans la bibliothèque pour le lire
- Les contrôles natifs du navigateur sont disponibles pour l'audio et la vidéo
- Pour les images, des contrôles additionnels sont disponibles pour l'édition

### Création de playlists

1. Sélectionnez un média et cliquez sur "Ajouter à la playlist"
2. Entrez un nom pour votre playlist et cliquez sur "Créer"
3. Pour lire une playlist, cliquez simplement sur son titre dans la section "Mes playlists"

### Édition d'images

Pour les images, plusieurs outils sont disponibles :
- Rotation (gauche/droite)
- Zoom (avant/arrière)
- Filtres (noir et blanc, sépia, inversion, flou, luminosité, contraste)

## Développement

Pour le développement, vous pouvez utiliser le mode de rechargement automatique :

```
npm run dev
```

## Technologies utilisées

- **Backend** : Node.js, Express
- **Frontend** : HTML5, CSS3, JavaScript (ES6+)
- **Médias** : HTML5 Audio/Video API, Canvas API
- **Style** : CSS personnalisé aux couleurs de l'ECL
