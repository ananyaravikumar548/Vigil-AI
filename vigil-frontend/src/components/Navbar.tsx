import React, { useState } from 'react';
import { Activity, ArrowRight, CheckCircle2, Cpu, LayoutList, Menu, Shield, SlidersHorizontal, X } from 'lucide-react';
import { ScreenId } from '../types';

interface NavbarProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
}

const NAV_ITEMS: { id: ScreenId; label: string; icon: React.ReactNode }[] = [
  { id: 'landing', label: 'Overview', icon: <Shield /> },
  { id: 'queue', label: 'Patient queue', icon: <LayoutList /> },
  { id: 'risk', label: 'Explainability', icon: <Cpu /> },
  { id: 'counterfactual', label: 'What-if', icon: <SlidersHorizontal /> },
  { id: 'orders', label: 'Sandbox', icon: <CheckCircle2 /> },
];

export const Navbar: React.FC<NavbarProps> = ({ currentScreen, onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigate = (screen: ScreenId) => {
    onNavigate(screen);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="page-shell flex min-h-[76px] items-center justify-between gap-4">
        <button
          id="brand-logo-btn"
          onClick={() => navigate('landing')}
          className="group flex shrink-0 items-center gap-3 text-left"
          aria-label="Vigil AI overview"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-[#10263a] text-white shadow-lg shadow-slate-900/10 transition-transform group-hover:-translate-y-0.5">
            <Activity className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span>
            <span className="block font-display text-[15px] font-bold tracking-[-0.04em] text-[#122236]">Vigil<span className="text-[#0b766e]"> AI</span></span>
            <span className="mt-0.5 block text-[10px] font-medium tracking-wide text-slate-500">CLINICAL DECISION SUPPORT</span>
          </span>
        </button>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const active = currentScreen === item.id;
            const Icon = item.icon.type as React.ComponentType<{ className?: string; strokeWidth?: number }>;
            return (
              <button
                key={item.id}
                id={`nav-item-${item.id}`}
                onClick={() => navigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-semibold transition-colors ${active ? 'bg-[#e9f5f2] text-[#075c57]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.9} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <button onClick={() => navigate('queue')} className="hidden items-center gap-2 rounded-full bg-[#0b766e] px-4 py-2.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-[#075c57] sm:inline-flex">
            Start review <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 lg:hidden"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav className="border-t border-slate-100 bg-white px-4 py-3 lg:hidden" aria-label="Mobile navigation">
          <div className="mx-auto grid max-w-2xl grid-cols-2 gap-2">
            {NAV_ITEMS.map((item) => {
              const active = currentScreen === item.id;
              const Icon = item.icon.type as React.ComponentType<{ className?: string; strokeWidth?: number }>;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-3 text-left text-sm font-semibold ${active ? 'bg-[#e9f5f2] text-[#075c57]' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.9} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
};
