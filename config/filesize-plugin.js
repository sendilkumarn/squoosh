const path = require('path');
const { promisify } = require('util');
const glob = promisify(require('glob'));
const minimatch = require('minimatch');
const gzipSize = require('gzip-size');
const chalk = require('chalk');
const prettyBytes = require('pretty-bytes');

module.exports = class FileSizePlugin {
  constructor (options) {
    this.options = options || {};
    this.pattern = this.options.pattern || '**/*.{mjs,js,css,html}';
    this.exclude = this.options.exclude || '{precache-manifest.**,report.html}';
  }

  async apply (compiler) {
    const outputPath = compiler.options.output.path;
    this.sizes = this.getSizes(outputPath);

    compiler.hooks.afterEmit.tap('filesize-plugin', compilation => {
      this.outputSizes(compilation.assets).catch(console.error);
    });
  };

  async outputSizes (assets) {
    // map of filenames to their previous size
    const sizesBefore = await this.sizes;

    const isMatched = minimatch.filter(this.pattern);
    const isExcluded = minimatch.filter(this.exclude);
    const assetNames = Object.keys(assets).filter(file => isMatched(file) && !isExcluded(file));
    const sizes = await Promise.all(assetNames.map(name => gzipSize(assets[name].source())));

    // map of de-hashed filenames to their final size
    this.sizes = toMap(assetNames.map(stripHash), sizes);

    // get a list of unique filenames
    const files = Object.keys(sizesBefore).concat(Object.keys(this.sizes)).filter(dedupe);

    const width = Math.max.apply(Math, files.map(file => file.length));
    for (const name of files) {
      const size = this.sizes[name] || 0;
      const delta = size - (sizesBefore[name] || 0);
      const msg = new Array(width - name.length + 2).join(' ') + name + ' ⏤  ';
      const color = size > 100 * 1024 ? 'red' : size > 40 * 1024 ? 'yellow' : size > 20 * 1024 ? 'cyan' : 'green';
      let sizeText = chalk[color](prettyBytes(size));
      if (delta) {
        let deltaText = (delta > 0 ? '+' : '') + prettyBytes(delta);
        if (delta > 1024) {
          sizeText = chalk.bold(sizeText);
          deltaText = chalk.red(deltaText);
        } else if (delta < -10) {
          deltaText = chalk.green(deltaText);
        }
        sizeText += ' (' + deltaText + ')';
      }
      console.log(msg + sizeText);
    }
    // FileSizeReporter.printFileSizesAfterBuild(
    //   stats,
    //   sizes,
    //   outputPath,
    //   (options.maxBundleSize || 512) * 1024,
    //   (options.maxChunkSize || 1024) * 1024
    // );
  }

  async getSizes (cwd) {
    const files = await glob(this.pattern, { cwd, ignore: this.exclude });

    const sizes = await Promise.all(files.map(
      file => gzipSize.file(path.join(cwd, file))
    ));

    return toMap(files.map(stripHash), sizes);
  }
};

function toMap (names, values) {
  return names.reduce((map, name, i) => {
    map[name] = values[i];
    return map;
  }, {});
}

function dedupe (item, index, arr) {
  return arr.indexOf(item) === index;
}

function stripHash (filename) {
  return filename.replace(/\.\w{5}(\.[a-z]{2,4})$/g, '$1');
}
