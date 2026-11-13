// A template's menu: rename, duplicate or delete it.
import { listTemplates, saveTemplate, saveTemplates, deleteTemplate } from '../data/db.js';
import { choiceSheet, confirmSheet, promptSheet } from '../components/dialogs.js';
import { esc } from '../components/util.js';

// ---------- Templates ----------

export async function templateMenu(id, redraw) {
  const list = await listTemplates();
  const i = list.findIndex((t) => t.id === id);
  const t = list[i];
  if (!t) return;
  const key = await choiceSheet({
    title: t.name,
    options: [
      { key: 'rename', label: 'Rename' },
      { key: 'duplicate', label: 'Duplicate' },
      ...(i > 0 ? [{ key: 'up', label: 'Move up' }] : []),
      ...(i < list.length - 1 ? [{ key: 'down', label: 'Move down' }] : []),
      { key: 'delete', label: 'Delete', danger: true },
    ],
  });
  if (!key) return;
  if (key === 'rename') {
    const v = await promptSheet({ title: 'Rename template', value: t.name });
    if (v && v !== t.name) await saveTemplate({ ...t, name: v });
  } else if (key === 'duplicate') {
    const copy = { ...t, id: undefined, createdAt: undefined, name: `${t.name} copy`, starter: false };
    delete copy.starterKey;
    list.splice(i + 1, 0, copy);
    await saveTemplates(list.map((x, n) => ({ ...x, sortOrder: n })));
  } else if (key === 'up' || key === 'down') {
    const j = key === 'up' ? i - 1 : i + 1;
    [list[i], list[j]] = [list[j], list[i]];
    await saveTemplates(list.map((x, n) => ({ ...x, sortOrder: n })));
  } else if (key === 'delete') {
    const ok = await confirmSheet({
      title: 'Delete template?',
      message: `<b>${esc(t.name)}</b> will be removed. Drafts made from it stay as they are.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await deleteTemplate(t.id);
  }
  await redraw();
}
