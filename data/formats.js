// Formats: the slide sizes a chapter can have, and the words for its pages.

export const SLIDE_W = 1080;
export const MAX_SLIDES = 20;
export const MIN_FRAME = 60;

export const RATIOS = {
  '3:4': { h: 1440, story: false, label: 'Feed post 3:4', size: '1080 × 1440', detail: 'Tall. Matches the profile grid.' },
  '4:5': { h: 1350, story: false, label: 'Feed post 4:5', size: '1080 × 1350', detail: 'The classic portrait size.' },
  '1:1': { h: 1080, story: false, label: 'Feed post 1:1', size: '1080 × 1080', detail: 'Square.' },
  '9:16': { h: 1920, story: true, label: 'Story 9:16', size: '1080 × 1920', detail: 'Full screen. One or a series.' },
  // Not for posting. `scale` multiplies the exported pixels, for printing.
  '2:3': { h: 1620, story: false, print: true, scale: 1, label: 'Photo 4 × 6', size: '4 × 6 in', detail: 'The usual photo print.' },
  '5:7': { h: 1512, story: false, print: true, scale: 1.5, label: 'Photo 5 × 7', size: '5 × 7 in', detail: 'A framed print.' },
  '8:10': { h: 1350, story: false, print: true, scale: 2, label: 'Print 8 × 10', size: '8 × 10 in', detail: 'A larger print.' },
  letter: { h: 1398, story: false, print: true, scale: 2, label: 'US Letter', size: '8.5 × 11 in', detail: 'A full sheet of paper.' },
  a4: { h: 1527, story: false, print: true, scale: 2, label: 'A4', size: '210 × 297 mm', detail: 'A full sheet of paper.' },
  '3:2': { h: 720, story: false, print: true, scale: 2, label: 'Landscape 3:2', size: '6 × 4 in', detail: 'A photo print on its side.' },
  '4:3': { h: 810, story: false, print: true, scale: 2, label: 'Landscape 4:3', size: '2160 × 1620', detail: 'Wide, for slides and screens.' },
  '16:9': { h: 608, story: false, print: true, scale: 2, label: 'Widescreen 16:9', size: '2160 × 1216', detail: 'Wider, for video and presentations.' },
};
export const RATIO_ORDER = ['3:4', '4:5', '1:1', '9:16'];
export const MORE_RATIOS = ['2:3', '5:7', '8:10', 'letter', 'a4', '3:2', '4:3', '16:9'];
export const DEFAULT_RATIO = '3:4';

export const slideH = (p) => RATIOS[p.ratio].h;
export const isStory = (p) => RATIOS[p.ratio].story;
export const stripW = (p) => p.slides * SLIDE_W;
// What a page is called: "slide" in a feed post, "story" in a Story.
export const isPrint = (p) => !!RATIOS[p.ratio].print;
export const pageWord = (p, plural = false) => {
  if (isStory(p)) return plural ? 'stories' : 'story';
  if (isPrint(p)) return plural ? 'pages' : 'page';
  return plural ? 'slides' : 'slide';
};
export const pageTitle = (p, plural = false) => {
  const word = pageWord(p, plural);
  return word[0].toUpperCase() + word.slice(1);
};

// Instagram's own buttons and captions cover the top and bottom of a Story.
export const SAFE_TOP = 250;
export const SAFE_BOTTOM = 340;

export const DEFAULT_BG = '#ffffff';

// The parts of a project a template keeps.
export const LAYOUT_KEYS = ['ratio', 'slides', 'background', 'padding', 'seamsOpen', 'borderWidth', 'borderColor'];
