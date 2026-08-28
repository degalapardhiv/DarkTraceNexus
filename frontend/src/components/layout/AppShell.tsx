'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, GitBranch, Shield, Clock,
  FileText, Search, Settings, Database, Brain, Eye,
  AlertTriangle, ChevronLeft, ChevronRight, LogOut, Menu,
  Target, Crosshair
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/actors', label: 'Threat Actors', icon: Users },
  { href: '/graph', label: 'Relationship Graph', icon: GitBranch },
  { href: '/attributions', label: 'Attributions', icon: Target },
  { href: '/evidence', label: 'Evidence', icon: Shield },
  { href: '/timeline', label: 'Timeline', icon: Clock },
  { href: '/investigation', label: 'Investigation', icon: Crosshair },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-16' : 'w-64'
        } flex-shrink-0 bg-dark-900 border-r border-dark-700/50 flex flex-col transition-all duration-300 hidden lg:flex`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-4 border-b border-dark-700/50">
          <div className="w-8 h-8 rounded-lg bg-cyber-blue/20 border border-cyber-blue/30 flex items-center justify-center flex-shrink-0">
            <Eye className="w-4 h-4 text-cyber-blue" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="text-sm font-bold text-gray-100 whitespace-nowrap">DarkTrace</div>
              <div className="text-[10px] text-cyber-blue font-mono whitespace-nowrap">NEXUS v1.0</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="p-2 border-t border-dark-700/50">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center py-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-dark-700/50 transition-all"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-dark-700/50 bg-dark-900/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden text-gray-400 hover:text-gray-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
              <AlertTriangle className="w-3 h-3 text-cyber-orange" />
              <span>DEFENSIVE INTELLIGENCE PLATFORM</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-800 border border-dark-600/50">
              <div className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
              <span className="text-xs text-gray-400">System Online</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-dark-700 border border-dark-600/50 flex items-center justify-center">
              <span className="text-xs text-gray-400 font-mono">A1</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-dark-950">
          {children}
        </main>
      </div>

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-dark-900 border-r border-dark-700/50 z-50 transform transition-transform lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center gap-3 px-4 border-b border-dark-700/50">
          <div className="w-8 h-8 rounded-lg bg-cyber-blue/20 border border-cyber-blue/30 flex items-center justify-center">
            <Eye className="w-4 h-4 text-cyber-blue" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-100">DarkTrace</div>
            <div className="text-[10px] text-cyber-blue font-mono">NEXUS v1.0</div>
          </div>
        </div>
        <nav className="py-3 px-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
