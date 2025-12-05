// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Hero from "./pages/Hero";
import AuthDriver from "./pages/auth/AuthDriver";
import AuthPassenger from "./pages/auth/AuthPassenger";
import DriverDashboard from "./pages/protected/DriverDashboard";
import PassengerDashboard from "./pages/protected/PassengerDashboard";
import AuthAdmin from "./pages/auth/AuthAdmin";
import AdminDashboard from "./pages/protected/AdminDashboard";

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Hero />} />
          <Route path="/auth-driver" element={<AuthDriver />} />
          <Route path="/auth-passenger" element={<AuthPassenger />} />
          <Route path="/auth-admin" element={<AuthAdmin />} />
          {/* Add dashboard routes */}
          <Route path="/dashboard/driver" element={<DriverDashboard />} />
          <Route path="/dashboard/passenger" element={<PassengerDashboard />} />
          <Route path="/dashboard/admin" element={<AdminDashboard />} /> {/* Add this route */}
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
