import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ConnectKitButton } from "connectkit";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import logoIcon from "../images/icon-48x48.png";

// Navigation component
const Navigation = () => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    console.log("🔍 Navigation Debug:");
    console.log("- Setting isClient to true");
    setIsClient(true);
  }, []);

  console.log("- isClient:", isClient);
  console.log("- ConnectKitButton will render:", isClient);

  return (
    <nav className="navbar bg-background border-b border-border w-full fixed top-0 p-4 flex justify-between items-center z-50">
      <div className="flex items-center gap-6">
        <div className="flex items-center">
          <span>
            <img src={logoIcon} alt="QIP Logo" />
          </span>
          <span className="mt-2">
            <Link to="/" className="ml-2 text-xl font-bold">
              Proposals
            </Link>
          </span>
        </div>
        <Link to="/all-proposals" className="text-foreground hover:text-primary cursor-pointer">
          All Proposals
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        {isClient && <ConnectKitButton />}
      </div>
    </nav>
  );
};

export default Navigation;
