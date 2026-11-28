// Dernier filet de sécurité de l'application (audit A-03).
//
// En React, une erreur levée pendant le rendu démonte tout l'arbre : sans ce
// composant, l'utilisateur voit une page entièrement blanche, sans message ni
// bouton. Sur une application installée sur téléphone (PWA), elle paraît alors
// cassée définitivement.
//
// Ce composant doit rester une classe : React n'offre pas d'équivalent en
// composant fonction pour componentDidCatch / getDerivedStateFromError.
import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '../shared/ui/Button';

interface Props {
  children: ReactNode;
  /** Appelé quand une erreur est rattrapée (tests, futur suivi d'erreurs) */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Visible dans la console du navigateur. C'est aussi ici qu'un service de
    // suivi des erreurs en production viendrait se brancher (audit A-25).
    console.error('Erreur non rattrapée :', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        className="flex min-h-screen items-center justify-center bg-surface p-6 text-center"
      >
        <div className="max-w-md space-y-4">
          <h1 className="card-title">Une erreur est survenue</h1>
          <p className="text-muted">
            Vos données sont intactes : elles sont enregistrées sur votre compte, pas dans cette
            page. Rechargez CalTrack pour continuer.
          </p>
          <Button onClick={() => window.location.reload()}>Recharger CalTrack</Button>
        </div>
      </div>
    );
  }
}
