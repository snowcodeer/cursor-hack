import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ConvexProvider, ConvexReactClient } from 'convex/react'

// Get Convex URL from environment variable
// This will be set automatically when you run `npx convex dev`
const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  console.warn(
    'VITE_CONVEX_URL is not set. Please run `npx convex dev` to set up Convex backend.\n' +
    'Story saving features will not work until Convex is configured.'
  );
}

const convex = new ConvexReactClient(convexUrl || 'https://placeholder.convex.cloud');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </React.StrictMode>,
)

