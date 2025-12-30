import ProfileHub from "./pages/ProfileHub";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import Discovery from "./pages/Discovery";
import Matches from "./pages/Matches";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import ProtectedRoute from "./components/ProtectedRoute";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* Protected routes - require authentication */}
      <Route path="/onboarding">
        {(params) => <ProtectedRoute component={Onboarding} {...params} />}
      </Route>
      <Route path="/discovery">
        {(params) => <ProtectedRoute component={Discovery} {...params} />}
      </Route>
      <Route path="/matches">
        {(params) => <ProtectedRoute component={Matches} {...params} />}
      </Route>
      <Route path="/chat/:matchId">
        {(params) => <ProtectedRoute component={Chat} {...params} />}
      </Route>
      <Route path="/profile/:userId">
        {(params) => <ProtectedRoute component={Profile} {...params} />}
      </Route>
      <Route path="/edit-profile">
        {(params) => <ProtectedRoute component={EditProfile} {...params} />}
      </Route>
      <Route path="/me">
        {(params) => <ProtectedRoute component={ProfileHub} {...params} />}
      </Route>
      
      {/* 404 routes */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;