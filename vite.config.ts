import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// TA-09: Auslieferung als ein einzelnes HTML, das offline im Browser läuft.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  test: {
    include: ['src/**/*.test.ts', 'testdata/**/*.test.ts'],
  },
});
