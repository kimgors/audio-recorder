import { defineConfig } from 'rollup';
import vue from 'rollup-plugin-vue';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';
import css from 'rollup-plugin-css-only';

export default defineConfig({
  input: 'src/index.js',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      exports: 'named'
    },
    {
      file: 'dist/index.esm.js',
      format: 'es',
      exports: 'named'
    },
    {
      file: 'dist/index.umd.js',
      format: 'umd',
      name: 'VueAudioRecorder',
      exports: 'named',
      globals: {
        vue: 'Vue'
      }
    }
  ],
  plugins: [
    css({
      output: 'audio-recorder.css'
    }),
    vue(),
    resolve({
      browser: true
    }),
    commonjs(),
    terser()
  ],
  external: ['vue']
});