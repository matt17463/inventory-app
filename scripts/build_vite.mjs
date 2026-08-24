import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

// Vite replaces browser environment variables while compiling. Netlify supplies
// the real values. Local/CI verification uses inert placeholders so a missing
// local .env cannot make Rolldown discard the application after a top-level
// configuration error. The placeholders are never suitable for a deployment.
const environment = {
  ...process.env,
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://build-check.invalid',
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'build-check-placeholder',
};
const viteEntry = path.resolve('node_modules/vite/bin/vite.js');
const child = spawn(process.execPath, [viteEntry, 'build'], {
  env: environment,
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`Vite could not be started: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  if (signal) console.error(`Vite stopped because of signal ${signal}.`);
  process.exitCode = code ?? 1;
});
