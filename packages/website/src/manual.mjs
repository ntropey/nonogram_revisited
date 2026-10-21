/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * The manual. Keep it in step with packages/app: a test checks the keyboard shortcuts listed here.
 */

/** Keyboard shortcuts, as handled in packages/app/src/App.tsx. `key` is the `KeyboardEvent.key` it listens for. */
export const SHORTCUTS = [
  { key: 'f', label: 'F', action: 'Fill tool' },
  { key: 'x', label: 'X', action: 'Cross tool' },
  { key: 'p', label: 'P', action: 'Why? tool (Prover)' },
  { key: 'h', label: 'H', action: 'Ask the Coach for a hint' },
  { key: 'z', label: 'Ctrl+Z', action: 'Undo (Cmd+Z on a Mac)' },
];

export const manualPage = {
  path: 'manual/index.html',
  title: 'Manual',
  active: 'manual',
  description: 'How to use the Nonogram Revisited app: tools, the Coach, the Why? prover, the library, settings and shortcuts.',
  body: `
<h1>Manual</h1>
<p>A reference for the <a href="/play/">Nonogram Revisited app</a>. New to Nonograms? Start with
<a href="/learn/how-to-play/">How to play</a>.</p>
<nav class="toc" aria-label="On this page">
<a href="#puzzles">Puzzles</a> <a href="#painting">Painting</a> <a href="#coach">Coach</a> <a href="#why">Why?</a>
<a href="#library">Library</a> <a href="#settings">Settings</a> <a href="#keys">Shortcuts</a> <a href="#data">Your data</a>
</nav>

<h2 id="puzzles">Puzzles</h2>
<p>Choose a <strong>Size</strong> (5 to 30) and optionally a <strong>Level</strong>, then press <strong>New
puzzle</strong>. Every generated puzzle has exactly one solution and is rated Easy, Medium, Hard,
Unfair or Extreme by the techniques needed to solve it. With Level set to Any you get whatever the
generator finds first; a chosen Level is a preference, and a different level may come back if none
turns up quickly.</p>
<p>When your board matches every clue, the puzzle is marked <strong>Solved</strong>, the board locks,
and the library shows a check mark. Undo reopens it.</p>

<h2 id="painting">Painting</h2>
<ul>
<li><strong>Fill</strong> and <strong>Cross</strong> choose what a click or drag paints. Pressing a cell that already has that mark erases it, and the drag then erases too.</li>
<li><strong>Right-click</strong> always crosses, whichever tool is selected. On a touch screen, use the Cross tool.</li>
<li>Drag across cells to paint a line. Fast drags fill the gaps between the cells you cross.</li>
<li><strong>Undo</strong> reverts one stroke, hint or solve. <strong>Reset</strong> clears the board, and Undo brings it back.</li>
<li>A clue fades when its row or column already matches it. With <em>Auto-cross finished lines</em> on, the empty cells of such a line are crossed out for you.</li>
</ul>

<h2 id="coach">Coach</h2>
<p>Press <strong>Coach</strong> (or <kbd>H</kbd>) for the next logical step on your current board. It
reveals the step in four stages, so you can stop as soon as you have the idea:</p>
<ol>
<li><strong>Where to look</strong>: the row or column is highlighted.</li>
<li><strong>Think it through</strong>: a question about that line, without the answer.</li>
<li><strong>The technique</strong>: its name, level and the reason it works, with the key cells outlined.</li>
<li><strong>The move</strong>: the cells to fill or cross out. Press <strong>Apply</strong> to make the move.</li>
</ol>
<p>The Coach always suggests the easiest technique available. If a mark on the board contradicts the
stored solution, the Coach first shows those cells in red and offers to clear them. If it finds no
deduction, the board is finished or needs more than the nine <a href="/techniques/">techniques</a>.</p>

<h2 id="why">Why? (the Prover)</h2>
<p>Select <strong>Why?</strong> (or <kbd>P</kbd>) and click an empty cell. The Prover asks two
questions about it: <em>Why not fill it?</em> and <em>Why not cross it out?</em> For each, it assumes
that answer and follows every cell that line logic then forces. If a row or column ends up with no
valid arrangement, the assumption is impossible, and the Prover lists the chain and offers to make
the other move.</p>
<p>If neither assumption breaks a line, the cell cannot be settled this way yet. Cross out or fill
other cells first and ask again. This is the same reasoning as <a href="/techniques/contradiction/">Line Contradiction</a>.</p>

<h2 id="library">Library and Solve</h2>
<p>Every puzzle you generate is saved in the <strong>Library</strong> (the 50 most recent), with its
size, level and your progress. Select one to continue it, or press <span aria-hidden="true">×</span> on
its row to delete it. <strong>Solve</strong> fills the board with the solver's answer. A puzzle revealed
this way is not counted as solved by you.</p>

<h2 id="settings">Settings</h2>
<p>Open the gear menu:</p>
<ul>
<li><strong>Highlight row &amp; column</strong>: tints the row and column under your pointer.</li>
<li><strong>Auto-cross finished lines</strong>: crosses out the rest of a line once its blocks match its clue.</li>
<li><strong>Sound</strong>: a soft click when you paint, and a chime when you finish.</li>
<li><strong>Light theme</strong>: switches between the dark and light themes.</li>
</ul>

<h2 id="keys">Keyboard shortcuts</h2>
<table>
<thead><tr><th>Key</th><th>Action</th></tr></thead>
<tbody>
${SHORTCUTS.map((s) => `<tr><td><kbd>${s.label}</kbd></td><td>${s.action}</td></tr>`).join('\n')}
</tbody>
</table>

<h2 id="data">Your data</h2>
<p>Settings and puzzles are stored in your browser's local storage, and the app works offline once
loaded. Clearing site data for this site removes them. Nothing you do in the app is sent to a server.</p>
<p><a class="play-link" href="/play/">Open the app &rarr;</a></p>
`,
};
