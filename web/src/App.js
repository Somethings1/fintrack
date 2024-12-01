import React, { useState, useEffect } from "react";

function App() {
    const [message, setMessage] = useState("");

    useEffect(() => {
        fetch("http://localhost:8080")
            .then((res) => res.text())
            .then((data) => setMessage(data))
            .catch((error) => {
                console.error("Error fetching data:", error);
                setMessage("Failed to load data from the backend.");
            });
    }, []);

    return <h1>{message || "Loading..."}</h1>;
}

export default App;

