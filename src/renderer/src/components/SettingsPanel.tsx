import React, { useState, useEffect } from 'react';

interface Rule {
  id: string;
  label: string;
  matchType: 'nativeApp' | 'browserTab';
  process: string[];
  titleRegex: string | null;
  closeAction: 'wm-close' | 'ctrl-w';
  enabled: boolean;
  confidence: 'high' | 'low' | 'unsupported';
}

const SettingsPanel: React.FC = () => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [autostart, setAutostart] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    // Fetch initial rules and settings from main process
    const loadSettings = async () => {
      try {
        const fetchedRules = await window.electron.ipcRenderer.invoke('rules:get');
        const fetchedAutostart = await window.electron.ipcRenderer.invoke('settings:get-autostart');
        setRules(fetchedRules || []);
        setAutostart(!!fetchedAutostart);
      } catch (err) {
        console.error('Failed to load settings from main process:', err);
      }
    };
    loadSettings();
  }, []);

  const handleRuleToggle = async (ruleId: string) => {
    const updatedRules = rules.map((rule) => {
      if (rule.id === ruleId) {
        return { ...rule, enabled: !rule.enabled };
      }
      return rule;
    });

    setRules(updatedRules);
    setSaving(true);
    try {
      await window.electron.ipcRenderer.invoke('rules:save', updatedRules);
    } catch (err) {
      console.error('Failed to save rules:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAutostartToggle = async () => {
    const nextValue = !autostart;
    setAutostart(nextValue);
    setSaving(true);
    try {
      await window.electron.ipcRenderer.invoke('settings:set-autostart', nextValue);
    } catch (err) {
      console.error('Failed to update autostart setting:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-container">
      <header className="settings-header">
        <h1>Pawse Focus Settings</h1>
        <p className="settings-subtitle">Manage distraction rules and app behavior</p>
      </header>

      <section className="settings-section">
        <h2>App Settings</h2>
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-info">
              <span className="settings-label">Start with Windows</span>
              <span className="settings-description">Automatically run Pawse when you log into your PC</span>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={autostart} 
                onChange={handleAutostartToggle}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2>Distraction Detection Rules</h2>
        <p className="section-desc">
          When these rules match your active foreground window, the cat will approach and close them.
        </p>
        
        <div className="rules-list">
          {rules.map((rule) => (
            <div key={rule.id} className="rule-card">
              <div className="rule-header">
                <div className="rule-details">
                  <div className="rule-title-group">
                    <span className="rule-label">{rule.label}</span>
                    <span className={`confidence-badge confidence-${rule.confidence}`}>
                      {rule.confidence} accuracy
                    </span>
                  </div>
                  <span className="rule-process">
                    Processes: <code>{rule.process.join(', ')}</code>
                    {rule.titleRegex && <> | Title regex: <code>{rule.titleRegex}</code></>}
                  </span>
                </div>
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={rule.enabled} 
                    onChange={() => handleRuleToggle(rule.id)}
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      {saving && <div className="saving-indicator">Saving settings...</div>}
    </div>
  );
};

export default SettingsPanel;
