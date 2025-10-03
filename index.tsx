import { render } from 'preact';
import { html } from 'htm/preact';
import { App } from './src/App';

render(html`<${App} />`, document.getElementById('root'));
