import Layout from './components/Layout.jsx';
import OrdersPage from './pages/OrdersPage.jsx';

// TODO(#2): gate the app behind login once JWT authentication exists.
export default function App() {
  return (
    <Layout>
      <OrdersPage />
    </Layout>
  );
}
