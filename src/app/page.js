"use client";
import { useState } from "react";
import LoginPage from "./Page/Login/LoginPage";       // ajusta la ruta según tu estructura
import DashboardPage from "./Page/Dashboard/DashboardPage";

export default function App() {
  const [user, setUser] = useState(null); // null = no autenticado

  if (!user) {
    return (
      <LoginPage
        onLoginSuccess={(u) => setUser(u)}
      />
    );
  }

  return (
    <DashboardPage
      user={user}
      onLogout={() => setUser(null)}
    />
  );
}
