import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/** Renders children for a logged-in user; otherwise redirects to /login. */
export default function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <p role="status" className="grid min-h-screen place-items-center text-sm text-slate-500">
        Checking your session…
      </p>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
