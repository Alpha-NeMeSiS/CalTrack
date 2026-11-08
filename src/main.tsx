// Point d'entrée de l'application
// Ce fichier initialise le rendu React dans la div #root, active StrictMode et
// enregistre le service worker (application installable / interface hors ligne)
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './lib/registerServiceWorker';
import { applyTheme, readStoredTheme } from './utils/theme';

// Thème mémorisé sur l'appareil (et suivi du réglage système)
applyTheme(readStoredTheme(), { persist: false });

// Création de la racine et rendu du composant principal
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

registerServiceWorker();
