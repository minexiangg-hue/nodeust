'use client';
import { createContext, useContext, type ReactNode } from 'react';
// The shared layout retains workspace state; route pages consume its active view.
export const CommunityScreenContext = createContext<ReactNode>(null);
export function CommunityRoute() { return useContext(CommunityScreenContext); }
