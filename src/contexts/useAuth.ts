import { useContext } from 'react';
import { AuthContext } from './AuthContext';

// Hook pratique pour consommer le contexte d'auth
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
