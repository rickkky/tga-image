import { defineConfig, type UserConfigExport } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ command, mode }) => {
  const config: UserConfigExport = {
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'TgaImage',
      },
      outDir: resolve(__dirname, 'dist'),
    },
    server: {
      host: true,
    },
  };
  return config;
});
