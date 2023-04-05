import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import generatePackageJson from 'rollup-plugin-generate-package-json';

import pkg from './package.json';

// @todo: generate the banner just for the creation of package
const createBanner = (packageName, releaseDate, releaseHash, version, author, homepageLink) => (
`/**
 * ${packageName} v${version}
 * ${releaseDate} - commit ${releaseHash}
 *
 * Copyright (c) ${author}
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
  const releaseHash = 'my-hash';

  const esModules = [
    {
      input: "./src/index.js",
      output: [
        {
          file: './dist/esm/index.min.js',
          format: 'es',
          sourcemap: true,
          banner: createBanner("@dragula2/core", releaseDate, releaseHash, pkg.version, pkg.author, pkg.homepage),
        }
      ],
      plugins: [
        babel({babelHelpers: "bundled"}),
        terser({ ecma: 8, safari10: true }),
        generatePackageJson({
          baseContents: {
            "type": "module"
          },
          outputFolder: './dist/esm'
        }),
      ],
    }
  ];

  const commonJs = [
    {
      input: "./src/index.js",
      output: [
        {
          file: './dist/cjs/index.min.js',
          format: 'cjs',
          sourcemap: true,
          banner: createBanner("@dragula2/core", releaseDate, releaseHash, pkg.version, pkg.author, pkg.homepage),
        }
      ],
      plugins: [
        commonjs(),
        babel({babelHelpers: "bundled"}),
        terser({ ecma: 8, safari10: true }),
        generatePackageJson({
          baseContents: {
            "type": "commonjs"
          },
          outputFolder: './dist/cjs'
        }),
      ],
    }
  ];

  return [...esModules, ...commonJs];
}
