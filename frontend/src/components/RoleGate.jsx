import { useAuth } from '../context/AuthContext.jsx';

/**
 * Shows children only to users whose role is in `roles`, e.g. <RoleGate roles={['admin']}>.
 * This only hides controls; the server still enforces permissions (403).
 */
export default function RoleGate({ roles, fallback = null, children }) {
  const { user } = useAuth();
  return user && roles.includes(user.role) ? children : fallback;
}
