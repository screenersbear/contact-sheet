// The starter templates go in once. Deleting a starter keeps it deleted.
import { saveTemplates, getMeta, setMeta } from './db.js';
import { starterTemplates } from './templates.js';

// The starter set goes in once. Deleting a starter keeps it deleted.
export async function seedStarters() {
  if (await getMeta('startersSeeded')) return;
  await saveTemplates(starterTemplates());
  await setMeta('startersSeeded', true);
}
