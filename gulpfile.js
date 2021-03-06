'use strict'

const gulp = require('gulp');
const mocha = require('gulp-mocha');
const typescript = require("gulp-typescript");
const babel = require('gulp-babel');
const sourcemaps = require('gulp-sourcemaps');
const del = require('del');
const merge = require('merge-stream');
const tsfmt = require('gulp-tsfmt');
const tslint = require("gulp-tslint");
const istanbul = require('gulp-istanbul');
const remapIstanbul = require('remap-istanbul/lib/gulpRemapIstanbul');
const codecov = require('gulp-codecov');
const yargs = require('yargs');

const tsconfig = typescript.createProject('tsconfig.json', { typescript: require('typescript') });
const tsCompileContext = ['./src/**/*.ts', './test/**/*.ts', './typings/index.d.ts'];
const tsSourceCode = ['src/**/*.ts', 'test/**/*.ts'];

const argv = yargs
  .usage(`Usage:
    gulp <task> [options]
    gulp test [-m <case>]`)
  .command('build')
  .command('lint')
  .command('test')
  .command('prepublish', 'Prepare for a release')
  .option('m', {
    alias: 'match',
    describe: 'Run test cases with matched name. (cmd: test)',
    default: 'test-',
    type: 'string'
  })
  .help('help')
  .argv;

// Available (public) tasks:
// - clean
// - format
// - lint
// - build
// - test
// - prepublish
// - ci

gulp.task('default', ['test']); // ['test', 'lint']

// clean generated files
gulp.task('clean', () => {
  return del(['lib', 'build', 'reports']);
});

// FIXME: format doesn't work with TypeScript 2.0
// reformat TypeScript source code
gulp.task('format', () => {
  return gulp.src(tsSourceCode, { base: "./" })
    .pipe(tsfmt({options: {IndentSize: 2}}))
    .pipe(gulp.dest('.'));
});

// TypeScript transpile
gulp.task('build', ['clean'], () => {
  const result = gulp.src(tsCompileContext)
    .pipe(sourcemaps.init())
    .pipe(typescript(tsconfig));
  const jsStream = result.js
    .pipe(babel({presets: ['es2015-node5']}))
    .pipe(sourcemaps.write('.', {includeContent:true, sourceRoot: './'}))
    .pipe(gulp.dest('./build'));
  const dtsStream = result.dts
    .pipe(gulp.dest('./build'));
  return merge(jsStream, dtsStream);
});

// instrument source for test coverage
gulp.task('pre-test', ['build'], () => {
  return gulp.src(['build/src/**/*.js'])
    .pipe(istanbul({includeUntested: true}))
    .pipe(istanbul.hookRequire())
});

gulp.task('run-test', ['pre-test'], () => {
  return gulp.src([`build/test/**/*${argv.m}*.js`])
    .pipe(mocha({ require: ['source-map-support/register']}))
    .pipe(istanbul.writeReports({
      reporters: ['json'],
      dir: 'reports/coverage'
    }));
});

// remap coverage report base on source maps
gulp.task('remap-istanbul', ['run-test'], () => {
  return gulp.src('reports/coverage/coverage-final.json')
    .pipe(remapIstanbul({
      basePath: './',
      reports: {
        'text': null,
        'lcovonly': 'reports/coverage/lcov.info',
        'html': 'reports/coverage/html'
      }
    }))
});

// Upload coverage report to https://codecov.io/gh/aleung/node-anyid
gulp.task('codecov', ['remap-istanbul'], () => {
  gulp.src('reports/coverage/lcov.info')
    .pipe(codecov());
});

// unit test
gulp.task('test', ['remap-istanbul']);

// run on travis-ci
gulp.task('ci', ['codecov']);

// lint (code checking)
gulp.task('lint', ['format'], () => {
  return gulp.src(tsSourceCode)
    .pipe(tslint())
    .pipe(tslint.report('full', { summarizeFailureOutput: true, emitError: false}));
});

gulp.task('prepublish', ['test'], () => {
  return gulp.src(['build/src/**/*']).pipe(gulp.dest('lib'));
});
