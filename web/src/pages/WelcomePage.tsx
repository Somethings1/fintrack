import { useNavigate } from "react-router-dom";

const WelcomePage = () => {
  const navigate = useNavigate();

  return (
    <div>
      <h1>Welcome to Finance Tracker</h1>
      <button onClick={() => navigate("/login")}>Go to Login</button>
    </div>
  );
};

export default WelcomePage;

