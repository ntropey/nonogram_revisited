/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Technique guides: one page per technique, each with a diagram that the tests verify against the engine.
 */
import { gridDiagram, lineDiagram } from './diagrams.mjs';

const LEVEL_NAMES = ['', 'Easy', 'Medium', 'Hard', 'Unfair', 'Extreme'];

/** Cells for a line example: positions map to 1 (filled) or -1 (crossed); the rest are unknown. */
const known = (length, marks) => Array.from({ length }, (_, i) => marks[i] ?? 0);

/**
 * Example kinds:
 * - `line`: a single row with `clues`, known cells, and the `deduced` cells the technique adds.
 * - `grid`: a whole board state (`cells`), with the single `deduced` cell and its focus.
 * `type` is the engine's technique id; tests assert the engine finds exactly this deduction.
 */
export const TECHNIQUES = [
  {
    type: 'FULL_ZERO_LINE',
    slug: 'full-zero-line',
    name: 'Full Line & Zero Line',
    level: 1,
    summary: 'A line with clue 0 is entirely crossed out, and a line whose clues plus mandatory gaps match its length is completely determined.',
    body: [
      'Two lines need no thinking at all. A line with the clue 0 has no blocks, so every cell is crossed out.',
      'A line whose clues, plus one empty cell between each pair of blocks, add up to exactly its length has only one possible layout. Here 2 + 1 + 1 plus two gaps is 6 cells, so the line is fully decided.',
      'Always scan for these first. They give you anchors for every other technique.',
    ],
    example: { kind: 'line', clues: [2, 1, 1], length: 6, marks: {}, deduced: [[0, 1], [1, 1], [2, -1], [3, 1], [4, -1], [5, 1]] },
  },
  {
    type: 'SIMPLE_BOXES',
    slug: 'simple-boxes',
    name: 'Simple Boxes (Clue Overlap)',
    level: 1,
    summary: 'Push each block as far one way and then the other; cells covered both times must be filled.',
    body: [
      'Slide the 7-block as far left as it goes: it covers cells 1 to 7. Slide it as far right: cells 4 to 10. Whatever it covers in both positions is certain.',
      'The more a clue fills the line, the bigger the overlap. A clue longer than half the line always overlaps itself in the middle.',
      'With several blocks, do this for each block separately, packing all blocks to one side and then the other.',
    ],
    example: { kind: 'line', clues: [7], length: 10, marks: {}, deduced: [[3, 1], [4, 1], [5, 1], [6, 1]] },
  },
  {
    type: 'SIMPLE_SPACES',
    slug: 'simple-spaces',
    name: 'Simple Spaces (Block Length Limit)',
    level: 1,
    summary: 'Cross out cells no block can reach, or gaps too short for any block.',
    body: [
      'Here a cross splits the line. The 4-block cannot fit in the three cells on the left, so they can never be part of a block.',
      'Cross out any space that is too small for the smallest block that could go there. It also works at the ends of a line, where no block can stretch that far.',
    ],
    example: { kind: 'line', clues: [4], length: 10, marks: { 3: -1 }, deduced: [[0, -1], [1, -1], [2, -1]] },
  },
  {
    type: 'FORCING',
    slug: 'forcing',
    name: 'Forcing (Edge & Wall Extension)',
    level: 2,
    summary: 'A filled cell against an edge or a wall forces its block to grow away from the boundary.',
    body: [
      'A filled cell on the very first position must be the start of the first block. With a clue of 4, that block has to run through cells 1 to 4, so the next three cells are filled.',
      'The same holds next to a crossed-out cell: the wall acts like the edge of the board.',
    ],
    example: { kind: 'line', clues: [4], length: 10, marks: { 0: 1 }, deduced: [[1, 1], [2, 1], [3, 1]] },
  },
  {
    type: 'GLUE_PUNCTURING',
    slug: 'glue-puncturing',
    name: 'Glue & Puncturing',
    level: 2,
    summary: 'Filled cells glue a block into place; a finished block is punctured by crosses on both sides.',
    body: [
      'Once the 2-block is complete, the cell right after it must be empty or it would make the block longer. Put a cross there.',
      'Glue is the reverse: a filled cell that can only belong to one block pulls that block over the neighbors it must reach.',
    ],
    example: { kind: 'line', clues: [2, 1], length: 8, marks: { 0: 1, 1: 1 }, deduced: [[2, -1]] },
  },
  {
    type: 'JOINING_SPLITTING',
    slug: 'joining-splitting',
    name: 'Joining & Splitting Blocks',
    level: 3,
    summary: 'Join two filled groups that must belong to the same block, or split them when joining would make a block too long.',
    body: [
      'There is only one block of 5, so the two filled cells at positions 2 and 5 must belong to it. Everything between them is filled.',
      'Splitting is the opposite case: when joining two groups would exceed every clue that could cover them, they must be separate blocks and the cell between them is crossed out.',
    ],
    example: { kind: 'line', clues: [5], length: 10, marks: { 1: 1, 4: 1 }, deduced: [[2, 1], [3, 1]] },
  },
  {
    type: 'MERCURY',
    slug: 'mercury',
    name: 'Mercury (Bouncing)',
    level: 3,
    summary: 'A block that would run into a filled cell right after it cannot start next to the wall, so it bounces away.',
    body: [
      'The 3-block cannot start right after the cross at position 1: it would occupy cells 2 to 4 and touch the filled cell at 5, making a block of 4. Cell 2 is therefore empty.',
      'Think of the block as a drop of mercury that slides away from a wall when the space ahead is not the right size.',
    ],
    example: { kind: 'line', clues: [3, 1], length: 10, marks: { 0: -1, 4: 1 }, deduced: [[1, -1]] },
  },
  {
    type: 'EDGE_LOOKAHEAD',
    slug: 'edge-lookahead',
    name: 'Edge Logic & 2-Line Lookahead',
    level: 4,
    summary: 'Test a cell and follow its immediate effect on the crossing lines; if a neighboring line breaks, the cell is decided.',
    body: [
      'Suppose the highlighted cell in row 2 were filled. That would force a neighboring cell in the same row, and row 3 would then be left with no valid arrangement of its clues.',
      'Because filling it breaks a line, it must be crossed out. This is a one-step lookahead, not a guess: you only follow forced consequences.',
    ],
    example: {
      kind: 'grid',
      rows: [[1, 1], [1, 2], [1, 2], [2], [2]],
      cols: [[3], [0], [1, 1], [5], [2]],
      width: 5,
      cells: [1, -1, -1, 1, -1, 1, -1, 0, 1, 0, 1, -1, 0, 1, 0, -1, -1, 0, 1, 0, -1, -1, 0, 1, 0],
      deduced: [9, -1],
    },
  },
  {
    type: 'CONTRADICTION',
    slug: 'contradiction',
    name: 'Line Contradiction (Bifurcation)',
    level: 5,
    summary: 'Assume a cell, follow every forced consequence, and if a line has no valid arrangement the opposite must be true.',
    body: [
      'Assume the highlighted cell in the bottom row is crossed out. That forces another cell, which forces another, and after a few steps column 1 cannot fit its clue.',
      'An assumption that leads to a broken line is false, so the cell must be filled. In the app, the Why? tool shows exactly this chain for any empty cell.',
      'This is the hardest technique here, but it never needs a guess: every step is forced.',
    ],
    example: {
      kind: 'grid',
      rows: [[1, 2], [3], [4], [5], [4], [1, 1]],
      cols: [[2], [5], [4], [4], [1, 3], [1, 1]],
      width: 6,
      cells: [0, 0, -1, -1, 1, 1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 1, 0, -1, 0, 1, 1, 1, 1, 0, -1, 1, 1, 1, 1, -1, -1, 0, -1, 0, 0, 0],
      deduced: [33, 1],
    },
  },
];

const stateWord = (s) => (s === 1 ? 'filled' : 'crossed out');

/** Render a technique's example diagram and a one-line text description of it. */
export function exampleDiagram(t) {
  const ex = t.example;
  if (ex.kind === 'line') {
    const after = ex.deduced.map(([pos, state]) => ({ pos, state }));
    const desc = after.map((d) => `cell ${d.pos + 1} ${stateWord(d.state)}`).join(', ');
    return {
      svg: lineDiagram({
        clues: ex.clues,
        before: known(ex.length, ex.marks),
        after,
        label: `Line with clue ${ex.clues.join(' ')}: deduces ${desc}.`,
      }),
      caption: `Highlighted cells are the new deductions: ${desc}.`,
    };
  }
  const [cellIndex, state] = ex.deduced;
  const r = Math.floor(cellIndex / ex.width) + 1;
  const c = (cellIndex % ex.width) + 1;
  return {
    svg: gridDiagram({
      rows: ex.rows,
      cols: ex.cols,
      cells: ex.cells,
      focus: [cellIndex],
      label: `Board state where row ${r}, column ${c} is deduced to be ${stateWord(state)}.`,
    }),
    caption: `The highlighted cell (row ${r}, column ${c}) must be ${stateWord(state)}.`,
  };
}

function page(t, i) {
  const { svg, caption } = exampleDiagram(t);
  const prev = TECHNIQUES[i - 1];
  const next = TECHNIQUES[i + 1];
  return {
    path: `techniques/${t.slug}/index.html`,
    title: t.name,
    active: 'techniques',
    description: t.summary,
    body: `
<p class="crumbs"><a href="/techniques/">Techniques</a> &rsaquo; ${i + 1} of ${TECHNIQUES.length}</p>
<h1>${t.name}</h1>
<p class="level level-${t.level}">Level ${t.level}: ${LEVEL_NAMES[t.level]}</p>
<p class="lead">${t.summary}</p>
<figure>${svg}<figcaption>${caption}</figcaption></figure>
${t.body.map((p) => `<p>${p}</p>`).join('\n')}
<p class="pager">${prev ? `<a href="/techniques/${prev.slug}/">&larr; ${prev.name}</a>` : '<span></span>'}${next ? `<a href="/techniques/${next.slug}/">${next.name} &rarr;</a>` : '<span></span>'}</p>
<p><a class="play-link" href="/play/">Practice in the app &rarr;</a></p>
`,
  };
}

export const techniquePages = [
  {
    path: 'techniques/index.html',
    title: 'Solving Techniques',
    active: 'techniques',
    description: 'Nine human-style Nonogram solving techniques, from the obvious to line contradictions, each with a diagram.',
    body: `
<h1>Solving Techniques</h1>
<p>Nonogram Revisited solves with nine human-style techniques, always trying the easiest first. Every
one is a forced deduction: none of them needs a guess. Each guide has a diagram you can follow.</p>
<div class="cards">
${TECHNIQUES.map(
  (t, i) => `<a class="card" href="/techniques/${t.slug}/">
<span class="level level-${t.level}">Level ${t.level} · ${LEVEL_NAMES[t.level]}</span>
<strong>${i + 1}. ${t.name}</strong>
<span>${t.summary}</span>
</a>`,
).join('\n')}
</div>
<p><a class="play-link" href="/play/">Try the Coach in the app &rarr;</a></p>
`,
  },
  ...TECHNIQUES.map(page),
];
