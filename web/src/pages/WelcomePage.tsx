import { useNavigate } from "react-router-dom";
import "./WelcomePage.css"; // Don’t forget to create this file for styling

const WelcomePage = () => {
    const navigate = useNavigate();

    return (
        <>
            <div className="welcome-container">
                <header className="welcome-hero">
                    <h1 className="welcome-title">Finance Tracker</h1>
                    <p className="welcome-subtitle">
                        Take control of your money. Effortlessly.
                    </p>
                    <button className="welcome-button" onClick={() => navigate("/login")}>
                        Get Started
                    </button>
                </header>
            </div>
        </>
    );
};

export default WelcomePage;

