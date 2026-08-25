/**
 * Production build targeting legacy Android WebView (Chrome 64+).
 * Ugoos AM6B Plus ships WebView 66, which lacks nullish coalescing (??),
 * optional chaining (?.), and private class fields (#).
 */
process.env.BROWSERSLIST = 'Chrome >= 64, Android >= 5';

const { execSync } = require('child_process');

execSync('npm run sync-server-config', { stdio: 'inherit', shell: true });
execSync('ng build --configuration production', { stdio: 'inherit', shell: true });
