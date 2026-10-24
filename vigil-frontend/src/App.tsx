import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScreenId, Patient } from './types';
import { PATIENTS } from './data/mockData';
import { Navbar } from './components/Navbar';
import { PatientHeader } from './components/PatientHeader';

// Core demo screens
import { LandingScreen } from './components/screens/LandingScreen';
import { QueueScreen } from './components/screens/QueueScreen';
import { RiskAttributionScreen } from './components/screens/RiskAttributionScreen';
import { CounterfactualScreen } from './components/screens/CounterfactualScreen';
import { OrdersAuditScreen } from './components/screens/OrdersAuditScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('landing');
  const [activePatient, setActivePatient] = useState<Patient>(PATIENTS[0]);

  // Screens that operate in the context of an individual patient
  const isPatientCentricScreen = [
    'risk',
    'counterfactual',
    'orders',
  ].includes(currentScreen);

  return (
    <div className="vigil-app min-h-screen text-slate-900 font-sans flex flex-col selection:bg-blue-600 selection:text-white">
      
      {/* Primary Top Clinical Bar */}
      <Navbar
        currentScreen={currentScreen}
        onNavigate={setCurrentScreen}
      />

      {/* Patient Header Banner (Active on patient-centric screens) */}
      {isPatientCentricScreen && (
        <PatientHeader
          patient={activePatient}
          onSelectPatient={setActivePatient}
          currentScreen={currentScreen}
          onNavigate={setCurrentScreen}
        />
      )}

      {/* Active Screen Viewport with Smooth Animated Transitions */}
      <main className="flex-1 relative overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScreen}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="w-full"
          >
            {currentScreen === 'landing' && (
              <LandingScreen
                onNavigate={setCurrentScreen}
              />
            )}

            {currentScreen === 'queue' && (
              <QueueScreen
                activePatient={activePatient}
                onSelectPatient={setActivePatient}
                onNavigate={setCurrentScreen}
              />
            )}

            {currentScreen === 'risk' && (
              <RiskAttributionScreen
                patient={activePatient}
                onNavigate={setCurrentScreen}
              />
            )}

            {currentScreen === 'counterfactual' && (
              <CounterfactualScreen
                patient={activePatient}
                onNavigate={setCurrentScreen}
              />
            )}

            {currentScreen === 'orders' && (
              <OrdersAuditScreen
                patient={activePatient}
                onNavigate={setCurrentScreen}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="mt-auto border-t border-slate-200/80 bg-white/75 px-4 py-5 sm:px-6 lg:px-8">
        <div className="page-shell flex flex-col gap-2 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Vigil AI · Research prototype · Not clinically validated</p>
          <p>Fictional demo data · Model estimates are not diagnoses or treatment recommendations</p>
        </div>
      </footer>

    </div>
  );
}
