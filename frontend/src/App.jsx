// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Hero from "./pages/Hero";
import AuthDriver from "./pages/auth/AuthDriver";
import AuthPassenger from "./pages/auth/AuthPassenger";
import DriverDashboard from "./pages/protected/DriverDashboard";
import PassengerDashboard from "./pages/protected/PassengerDashboard";

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Hero />} />
          <Route path="/auth-driver" element={<AuthDriver />} />
          <Route path="/auth-passenger" element={<AuthPassenger />} />
          {/* Add dashboard routes */}
          <Route path="/dashboard/driver" element={<DriverDashboard />} />
          <Route path="/dashboard/passenger" element={<PassengerDashboard />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
