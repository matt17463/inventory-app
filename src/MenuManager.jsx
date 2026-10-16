import { useMemo, useState } from 'react';
import { useNavigationLayout } from './lib/navigationContext';
import { moveNavigationItem } from './lib/navigationPreferences';

export default function MenuManager() {
  const { layout, updateLayout, resetLayout, baseNav } = useNavigationLayout();
  const [message, setMessage] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [dragged, setDragged] = useState(null);
  const labels = useMemo(() => new Map(baseNav.flatMap((g) => g.items.map((item) => [item.path, item]))), [baseNav]);
  const hidden = new Set(layout.hiddenPaths);

  const save = (updater) => {
    updateLayout(updater);
    setMessage('Menu layout saved for your signed-in account on this browser. The sidebar uses these same groups as collapsible sections.');
  };
  const moveGroup = (index, direction) => save((current) => {
    const groups = [...current.groups];
    const other = index + direction;
    if (other < 0 || other >= groups.length) return current;
    [groups[index], groups[other]] = [groups[other], groups[index]];
    return { ...current, groups };
  });
  const moveItem = (groupId, path, direction) => save((current) => {
    const group = current.groups.find((g) => g.id === groupId);
    const index = group?.paths.indexOf(path) ?? -1;
    if (index < 0 || index + direction < 0 || index + direction >= group.paths.length) return current;
    return moveNavigationItem(current, path, groupId, index + direction);
  });
  const updateGroup = (id, value) => save((current) => ({
    ...current, groups: current.groups.map((group) => group.id === id ? { ...group, title: value } : group),
  }));
  const removeGroup = (id) => {
    if (layout.groups.length < 2) return;
    const removing = layout.groups.find((group) => group.id === id);
    if (!removing || !window.confirm('Remove group "' + removing.title + '"? Its pages will move into another group.')) return;
    save((current) => {
      const survivor = current.groups.find((group) => group.id !== id);
      return {
        ...current,
        groups: current.groups.filter((group) => group.id !== id)
          .map((group) => group.id === survivor.id ? { ...group, paths: [...group.paths, ...removing.paths] } : group),
      };
    });
  };
  const addGroup = (event) => {
    event.preventDefault();
    if (!newGroup.trim()) return;
    save((current) => ({
      ...current,
      groups: [...current.groups, { id: 'custom-' + Date.now(), title: newGroup.trim().slice(0, 60), icon: '▣', paths: [] }],
    }));
    setNewGroup('');
  };
  const toggle = (path) => save((current) => ({
    ...current,
    hiddenPaths: current.hiddenPaths.includes(path)
      ? current.hiddenPaths.filter((p) => p !== path)
      : [...current.hiddenPaths, path],
  }));
  const dropItem = (groupId, index = -1) => {
    if (!dragged) return;
    save((current) => moveNavigationItem(current, dragged, groupId, index));
    setDragged(null);
  };

  return (
    <div className="sc-page sc-menu-manager">
      <header className="sc-menu-manager-header">
        <div>
          <p className="sc-kicker">App settings / Personalization</p>
          <h1>Menu Manager</h1>
          <p>Organize the left navigation, create your own groups, move pages, and hide entries you rarely use.</p>
        </div>
        <button type="button" className="secondary" onClick={() => {
          if (window.confirm('Restore the default navigation for this account on this browser?')) {
            resetLayout();
            setMessage('Default menu restored.');
          }
        }}>Restore default</button>
      </header>
      <p className="helper-text">Changes are saved automatically on this browser for your account. Hidden links remain accessible by direct URL; menu visibility never changes permissions. Use the arrow buttons on touchscreens or drag entries with a mouse.</p>
      <form className="sc-menu-add-group" onSubmit={addGroup}>
        <label htmlFor="sc-new-menu-group">Create group</label>
        <input id="sc-new-menu-group" maxLength={60} value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="e.g. Daily Operations" />
        <button type="submit" disabled={!newGroup.trim()}>Add group</button>
      </form>
      <div className="sc-menu-manager-groups">
        {layout.groups.map((group, groupIndex) => (
          <section key={group.id} className="sc-nav-editor-group" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); dropItem(group.id); }}>
            <div className="sc-nav-editor-heading">
              <label htmlFor={'sc-group-' + group.id}>Group name</label>
              <input id={'sc-group-' + group.id} maxLength={60} value={group.title} onChange={(e) => updateGroup(group.id, e.target.value)} />
              <button type="button" aria-label={'Move ' + group.title + ' up'} disabled={groupIndex === 0} onClick={() => moveGroup(groupIndex, -1)}>↑</button>
              <button type="button" aria-label={'Move ' + group.title + ' down'} disabled={groupIndex === layout.groups.length - 1} onClick={() => moveGroup(groupIndex, 1)}>↓</button>
              <button type="button" aria-label={'Remove group ' + group.title} disabled={layout.groups.length < 2} onClick={() => removeGroup(group.id)}>Remove</button>
            </div>
            {group.paths.length === 0 && <p className="helper-text">This group is empty. Move a page here using another group's selector.</p>}
            {group.paths.map((path, index) => {
              const item = labels.get(path);
              if (!item) return null;
              return (
                <div key={path} className="sc-nav-editor-item" draggable onDragStart={() => setDragged(path)} onDragEnd={() => setDragged(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); event.preventDefault(); dropItem(group.id, index); }}>
                  <span aria-hidden="true" title="Drag to reposition">⠿</span>
                  <div className="sc-nav-editor-label"><strong>{item.label}</strong><small>{path}</small></div>
                  <label className="sc-nav-editor-visible">
                    <input type="checkbox" checked={!hidden.has(path)} onChange={() => toggle(path)} />
                    Show
                  </label>
                  <select aria-label={'Move ' + item.label + ' to group'} value={group.id} onChange={(event) => save((current) => moveNavigationItem(current, path, event.target.value))}>
                    {layout.groups.map((target) => <option value={target.id} key={target.id}>{target.title}</option>)}
                  </select>
                  <button type="button" aria-label={'Move ' + item.label + ' up'} disabled={index === 0} onClick={() => moveItem(group.id, path, -1)}>↑</button>
                  <button type="button" aria-label={'Move ' + item.label + ' down'} disabled={index === group.paths.length - 1} onClick={() => moveItem(group.id, path, 1)}>↓</button>
                </div>
              );
            })}
          </section>
        ))}
      </div>
      <div role="status" aria-live="polite">{message}</div>
    </div>
  );
}
