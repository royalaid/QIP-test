import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ConnectKitButton } from "connectkit";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { GradientButton } from "@/components/gradient-button";
import logoIcon from "../images/icon-48x48.png";

// Navigation component
const Navigation = () => {
  const [isClient, setIsClient] = useState(false);
  const navigate = useNavigate();

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
        <div className="flex items-center gap-2">
          <img src={logoIcon} alt="QIP Logo" className="h-8 w-8" />
          <Link to="/" className="text-xl font-bold">
            Proposals
          </Link>
        </div>
        <Link to="/all-proposals" className="text-foreground hover:text-primary">
          All Proposals
        </Link>
        <GradientButton variant="primary" onClick={() => navigate("/create-proposal")} className="text-sm py-2 px-6">
          Create
        </GradientButton>
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        {isClient && <ConnectKitButton />}
      </div>
    </nav>
  );
};

export default Navigation;
