export type Props = {
  href?: string;
  label?: string;
  className?: string;
  as?: 'link' | 'button';
  onAfterNav?: () => void;
};

const baseClasses =
  'inline-block px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-md transition-colors';

const BackToDashboardButton = ({
  href = '/dashboard',
  label = 'Retour au tableau de bord',
  className,
  as = 'link',
  onAfterNav,
}: Props) => {
  const classes = className ? `${baseClasses} ${className}` : baseClasses;

  const navigate = () => {
    window.dispatchEvent(new CustomEvent('navigate-to-board'));
    if (href !== '/dashboard') {
      window.location.hash = href;
    }
    onAfterNav?.();
  };

  if (as === 'button') {
    return (
      <button
        type='button'
        aria-label={label}
        className={classes}
        onClick={navigate}
      >
        {label}
      </button>
    );
  }

  return (
    <button type='button' aria-label={label} className={classes} onClick={navigate}>
      {label}
    </button>
  );
};

export default BackToDashboardButton;
