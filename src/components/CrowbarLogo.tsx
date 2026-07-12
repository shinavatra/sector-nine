import logoImage from "figma:asset/b1d4ebe7933805fb4c8794d05e542e1ce37db26e.png";

export function CrowbarLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <img 
      src={logoImage} 
      alt="Crowbar.gg Logo" 
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}
