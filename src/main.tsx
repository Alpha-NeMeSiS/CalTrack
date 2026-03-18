// Point d'entrée de l'application
// Ce fichier initialise le rendu React dans la div #root et active StrictMode
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Agentation } from 'agentation';
import App from './App.tsx';
import './index.css';

declare const process:
  | {
      env?: {
        NODE_ENV?: string;
      };
    }
  | undefined;

const isDevelopment =
  import.meta.env.DEV &&
  (typeof process === 'undefined' || process.env?.NODE_ENV === 'development');

// Création de la racine et rendu du composant principal
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <>
      <App />
      {isDevelopment && <Agentation />}
    </>
  </StrictMode>
);
