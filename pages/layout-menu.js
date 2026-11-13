// A layout's ... menu on the home page (round 2, 01-home): rename it, make a
// copy of it (with its own copies of the photos), or delete it.
import { getProject, saveProject, duplicateProject, deleteProject } from '../data/db.js';
import { choiceSheet, confirmSheet, promptSheet } from '../components/dialogs.js';
import { esc } from '../components/util.js';

// redraw: puts the list back once something changed.
export async function layoutMenu(id, redraw) {
  const p = await getProject(id);
  if (!p) return;
  const key = await choiceSheet({
    title: p.name,
    options: [
      { key: 'rename', label: 'Rename', detail: 'Also names the exported files.' },
      { key: 'duplicate', label: 'Duplicate', detail: 'A copy with its own photos.' },
      { key: 'delete', label: 'Delete', detail: 'It and its photos go from this device.', danger: true },
    ],
  });
  if (key === 'rename') {
    const v = await promptSheet({ title: 'Rename', value: p.name });
    if (!v || v === p.name) return;
    await saveProject({ ...p, name: v });
  } else if (key === 'duplicate') {
    await duplicateProject(p.id, `${p.name} copy`);
  } else if (key === 'delete') {
    const ok = await confirmSheet({
      title: 'Delete layout?',
      message: `<b>${esc(p.name)}</b> and its photos will be deleted from this device. Photos in your camera roll stay where they are.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await deleteProject(p.id);
  } else {
    return;
  }
  await redraw();
}
