import React from "react";
import { createRoot } from "react-dom/client";
import EchoLink from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(<React.StrictMode><EchoLink /></React.StrictMode>);
