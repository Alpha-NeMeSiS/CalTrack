// Point d'entrée de l'application
// Ce fichier initialise le rendu React dans la div #root et active StrictMode
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Création de la racine et rendu du composant principal
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
