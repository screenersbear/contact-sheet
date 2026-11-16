// Asks for Rounds (round 2, thanks): the other notebooks never write Rounds'
// data, so The Eye's SHE WROTE FIRST and its selects reminder (a moment, 16
// Nov) leave an ask in df-links (and, before 16 Nov, the person page's ADD A
// NOTE, a row's how and note changed, or a note deleted),
// a 'rounds-ask' link to the person's Rounds id. Rounds does each one with
// its own functions the next time it opens (rounds/data/asks.js), then marks
// it taken. Until then the person page shows DONE SO FAR as it will be.
//   ask: { do: 'done', personId, kind, note }       a move done, with a note
//        { do: 'moment', personId, day, what, note, keeps } a moment (rounds/data/moments.js)
//        { do: 'note', personId, day, how, note }    a note on its own
//        { do: 'edit', personId, lineId, how, note } a row's how and note
//        { do: 'drop', personId, lineId }            a note on its own taken out
// Part of window.DFData.
(function () {
  'use strict';
  const parts = window.DFDataParts;
  const TYPE = 'rounds-ask';

  const askRounds = (fromApp, ask) => parts.saveLink({ fromApp, fromId: '', toApp: 'rounds', toId: ask.personId, type: TYPE, ask });
  // The asks Rounds hasn't taken yet, for one of its people (or all), oldest first.
  const roundsAsks = async (personId) => (await parts.linksWhere({ toApp: 'rounds', type: TYPE, ...(personId ? { toId: personId } : {}) })).filter((l) => !l.takenAt);

  // SO FAR as it will be once Rounds takes these asks: rows as Rounds
  // published them (rounds/data/so-far.js doneSoFar), asks as above (the
  // links), choices: Rounds' how chips, { move, note, moment }, each [key,
  // label, words]. A note or a moment waiting is a row of its own (id
  // 'ask:<link id>', pending).
  function doneWithAsks(rows, asks, choices) {
    const words = (noteOnly, how) => {
      const c = ((choices && choices[noteOnly ? 'note' : 'move']) || []).find((x) => x[0] === how);
      return (c && c[2]) || '';
    };
    let out = Array.isArray(rows) ? [...rows] : [];
    for (const l of asks || []) {
      const a = (l && l.ask) || {};
      if (a.do === 'moment') {
        const c = ((choices && choices.moment) || []).find((x) => x[0] === a.what);
        out.unshift({ id: `ask:${l.id}`, day: a.day || '', look: 'moment', mark: 'rounds', what: (c && c[2]) || 'A moment', how: a.what || '', howWords: '', note: a.note || '', noteOnly: false, pending: true });
      } else if (a.do === 'note') {
        out.unshift({ id: `ask:${l.id}`, day: a.day || '', look: 'note', what: 'Note', how: a.how || '', howWords: words(true, a.how), note: a.note || '', noteOnly: true, pending: true });
      } else if (a.do === 'edit') {
        out = out.map((r) => (r.id && r.id === a.lineId ? { ...r, how: a.how || '', howWords: words(r.noteOnly, a.how), note: a.note || '' } : r));
      } else if (a.do === 'drop') out = out.filter((r) => !r.id || r.id !== a.lineId);
    }
    return out.sort((x, y) => String(y.day).localeCompare(String(x.day)));
  }

  Object.assign(parts, { askRounds, roundsAsks, doneWithAsks });
})();
