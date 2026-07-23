import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-md">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 rounded-3xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <ShieldAlert className="h-12 w-12 text-destructive/70" />
          </div>
        </div>

        {/* Error Code */}
        <div className="text-8xl font-black text-foreground/5 leading-none mb-2 select-none">
          404
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-foreground mb-3">
          Route Not Found
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-sm mx-auto">
          The surveillance route you requested doesn't exist or has been relocated. 
          Please verify the URL or return to the operations dashboard.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            id="not-found-go-back"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border border-border rounded-xl hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
          <button
            id="not-found-home"
            onClick={() => navigate("/")}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Home className="h-4 w-4" />
            Operations Dashboard
          </button>
        </div>
      </div>

      <p className="absolute bottom-6 text-xs text-muted-foreground/50">
        SentralQ v1.0 — Enterprise Surveillance Intelligence
      </p>
    </div>
  );
};

export default NotFound;
