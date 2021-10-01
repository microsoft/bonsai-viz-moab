/*
* index.tsx
* Copyright: Microsoft 2019
*
* Main page for moab simulator visualizer.
*/

import './index.css';

import React from 'react';
import ReactDOM from 'react-dom';

import MoabVisualizer from './MoabVisualizer';

ReactDOM.render(<MoabVisualizer />, document.getElementById('root'));
