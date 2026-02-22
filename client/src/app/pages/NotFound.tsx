import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Home, Search } from "lucide-react";

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-2">
          <div className="text-6xl font-bold text-primary">404</div>
          <h1 className="text-3xl font-bold">Mystery Unsolved</h1>
          <p className="text-muted-foreground">
            The page you're looking for has vanished without a trace.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => navigate("/")} size="lg">
            <Home className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)} size="lg">
            Go Back
          </Button>
        </div>

        <div className="pt-8 text-sm text-muted-foreground">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Looking for a game? Make sure you have the correct room code.</p>
        </div>
      </div>
    </div>
  );
}
