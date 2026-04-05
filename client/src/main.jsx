import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
//import 'whatwg-fetch';
if (typeof window !== 'undefined') {
  globalThis.Request = window.Request;
  globalThis.Response = window.Response;
}
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
