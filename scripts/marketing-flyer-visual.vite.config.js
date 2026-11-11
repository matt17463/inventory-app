import { defineConfig } from 'vite';

// Bundle the existing native flyer renderer for isolated visual QA against
// authorized artwork. This does not modify the application build.
export default defineConfig({
  build: {
    outDir: 'artifacts/marketing-flyers',
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: 'src/lib/marketingProgramPdf.js',
      formats: ['es'],
      fileName: 'marketingProgramPdf.bundle',
    },
  },
});
