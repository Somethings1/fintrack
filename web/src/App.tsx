import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import WelcomePage from "./pages/WelcomePage";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";

const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const token = localStorage.getItem("accessToken");
  return token ? children : <Navigate to="/login" />;
};

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/home" element={<PrivateRoute><HomePage /></PrivateRoute>} />
      </Routes>
    </Router>
  );
};

export default App;

