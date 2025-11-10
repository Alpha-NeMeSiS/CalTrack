import Link from "next/link";
import { useRouter } from "next/navigation";

export type Props = {
  href?: string;
  label?: string;
  className?: string;
  as?: "link" | "button";
  onAfterNav?: () => void;
};

const baseClasses =
  "inline-block px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-md transition-colors";

const BackToDashboardButton = ({
  href = "/dashboard",
  label = "Retour au tableau de bord",
  className,
  as = "link",
  onAfterNav,
}: Props) => {
  const router = useRouter();
  const classes = className ? `${baseClasses} ${className}` : baseClasses;

  const handleAfterNav = () => {
    if (onAfterNav) {
      onAfterNav();
    }
  };

  if (as === "button") {
    const handleButtonClick = () => {
      router.push(href);
      handleAfterNav();
    };

    return (
      <button
        type="button"
        aria-label={label}
        className={classes}
        onClick={handleButtonClick}
      >
        {label}
      </button>
    );
  }

  return (
    <Link href={href} aria-label={label} className={classes} onClick={handleAfterNav}>
      {label}
    </Link>
  );
};

export default BackToDashboardButton;

{
  /* Exemple :
  <BackToDashboardButton />
  <BackToDashboardButton as="button" href="/" className="mt-2" />
  */
}
