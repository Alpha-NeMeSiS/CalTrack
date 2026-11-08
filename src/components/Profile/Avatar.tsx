// Avatar : photo de profil, sinon initiales sur fond vert foncé (contraste AA).
import { useState } from 'react';
import { getInitials, IdentityLike } from '../../utils/avatar';

interface AvatarProps {
  identity: IdentityLike & { profile_picture_url?: string | null };
  /** Classes de taille et de texte, ex. « h-9 w-9 text-sm » */
  className?: string;
}

export function Avatar({ identity, className = 'h-9 w-9 text-sm' }: AvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = identity.profile_picture_url;

  if (url && url !== failedUrl) {
    return (
      <img
        src={url}
        alt=""
        aria-hidden="true"
        onError={() => setFailedUrl(url)}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand-700 font-semibold text-on-color ${className}`}
    >
      {getInitials(identity)}
    </span>
  );
}
