import React, { useState, useEffect } from 'react';
import Cat from './components/Cat';
import SettingsPanel from './components/SettingsPanel';

function App(): React.JSX.Element {
  const [route, setRoute] = useState<string>('');

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash);
    };

    handleHashChange(); // run immediately on mount
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (route === '#settings') {
    return <SettingsPanel />;
  }

  return <Cat />;
}

export default App;
