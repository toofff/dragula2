import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import {execSync} from 'child_process';
import {readFileSync} from 'fs';

const packageToJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const createBanner = (packageName, releaseDate, releaseHash, version, author, homepageLink) => (
  `/**
 * ${packageName} v${version}
 * ${releaseDate} - commit ${releaseHash}
 *
 * Copyright (c) 2021-present ${author}
 *
 * ${homepageLink}
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 *
 * @license MIT
 */`
);

export default () => {
  const releaseDate = (new Date()).toUTCString();
  // @todo: find the hash of the commit
  const releaseHash = execSync('git rev-parse HEAD').toString();
  const outputBase = {
    banner: createBanner(
      packageToJson.name,
      releaseDate,
      releaseHash,
      packageToJson.version,
      packageToJson.author,
      packageToJson.homepage
    ),
    compact: true,
    sourcemap: true,
  }

  // ESM, standard bundler
  const esModules = [
    {
      input: './src/index.js',
      strictDeprecations: true,
      output: [
        {
          ...outputBase,
          file: './dist/dragula.modern.mjs',
          format: 'es',
        },
        {
          ...outputBase,
          file: './dist/dragula.modern.min.mjs',
          format: 'es',
          plugins: [
            terser({ecma: 'esnext', module: true}),
          ],
        },
      ],
      // plugins: [
      //   {
      //     name: 'emit-module-package-file',
      //     generateBundle() {
      //       this.emitFile({
      //         type: 'asset',
      //         fileName: 'package.json',
      //         source: `{"type":"module"}`
      //       });
      //     },
      //   }
      // ],
    }
  ];

  // ESM, Webpack 4 support
  const legacyESModules = [
    {
      input: './src/index.js',
      output: [
        {
          ...outputBase,
          file: './dist/dragula.legacy-esm.js',
          format: 'es',
        },
        {
          ...outputBase,
          file: './dist/dragula.legacy-esm.min.js',
          format: 'es',
          plugins: [
            terser({ecma: 'esnext'}),
          ],
        },
      ],
      // plugins: [
      //   terser({ ecma: 2017, module: true, safari10: true }),
      //   generatePackageJson({
      //     baseContents: {
      //       "type": "module"
      //     },
      //     outputFolder: './dist/legacy-esm'
      //   }),
      // ],
    }
  ];

  const commonJs = [
    {
      input: './src/index.js',
      output: [
        {
          ...outputBase,
          exports: 'named',
          file: './dist/cjs/dragula.cjs',
          footer: 'module.exports = Object.assign(exports.default, exports);',
          format: 'cjs',
        },
        {
          ...outputBase,
          exports: 'named',
          file: './dist/cjs/dragula.min.cjs',
          footer: 'module.exports = Object.assign(exports.default, exports);',
          format: 'cjs',
          plugins: [
            terser({ecma: 'esnext'}),
          ],
        },
      ],
      plugins: [
        commonjs(),
        // {
        //   name: 'emit-common-package-file',
        //   generateBundle() {
        //     this.emitFile({
        //       type: 'asset',
        //       fileName: 'package.json',
        //       source: `{"type":"commonjs"}`
        //     });
        //   },
        // }
      ],
    }
  ];

  return [...esModules, ...legacyESModules, ...commonJs];
}
