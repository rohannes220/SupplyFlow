import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function UsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function loadUsers() {
      try {
        const response = await fetch('/api/users', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error?.message || 'Unable to load users');
        setUsers(body);
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
      }
    }
    loadUsers();
    return () => controller.abort();
  }, [token]);

  return (
    <section>
      <h1 className="mb-4 text-2xl font-semibold">Employees and administrators</h1>
      {error && <p role="alert">{error}</p>}
      {!users && !error && <p>Loading users…</p>}
      {users && (
        <table className="w-full text-left">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
