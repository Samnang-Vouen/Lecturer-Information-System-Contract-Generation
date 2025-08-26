import * as React from 'react';
// Temporary stub for missing lucide-react Chrome icon (upstream package issue where chrome.js is absent but referenced)
const Chrome = React.forwardRef(function Chrome(props, ref) {
  return React.createElement(
    'svg',
    { ...props, ref, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement('circle', { cx: 12, cy: 12, r: 10 }),
    React.createElement('circle', { cx: 12, cy: 12, r: 4 })
  );
});
Chrome.displayName = 'Chrome';
export default Chrome;
