# (IN)NUMERI! - Syllable Length Marker

A web application for marking syllable lengths in classical Latin and Ancient Greek poetry.

## Files

- **index.html** - Main HTML structure
- **styles.css** - All styling and layout
- **script.js** - Application logic and functionality
- **syllable-marker.html** - Original single-file version (kept for backup)

## Features

- Auto-detection of vowels and diphthongs (Latin and polytonic Greek)
- Sophisticated Greek diphthong detection with accent/breathing rules
- Keyboard-driven marking interface
- Typewriter mode (centered current line)
- Error checking for dactylic and iambo-trochaic meters
- LocalStorage for persistent data
- Automatic font switching (Fira Code for Greek text)

## Deployment

To deploy online:
1. Upload `index.html`, `styles.css`, and `script.js` to your web server
2. Ensure all three files are in the same directory
3. Access via `index.html`

The app uses:
- Google Fonts (Fira Code) - loaded from CDN
- LocalStorage for data persistence
- No backend required - fully client-side

## Usage

Open `index.html` in a web browser. The application works entirely client-side, so it can be:
- Hosted on any static web server
- Opened directly from the filesystem
- Deployed to GitHub Pages, Netlify, Vercel, etc.
