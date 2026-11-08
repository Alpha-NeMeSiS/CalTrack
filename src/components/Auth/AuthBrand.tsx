// Logo et nom de l'application au-dessus des écrans de connexion,
// d'inscription et de mot de passe.
import logo from '../../assets/brand/logo-mark.png';

export function AuthBrand() {
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      <img src={logo} alt="" aria-hidden="true" className="h-20 w-20 object-contain" />
      <p className="mt-2 font-display text-3xl tracking-wide text-accent-700">CalTrack</p>
      <p className="text-sm text-muted">Suivi calorique personnalisé</p>
    </div>
  );
}
