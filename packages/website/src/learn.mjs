/*
 * Nonogram Revisited. GPL-3.0-or-later; see LICENSE.
 * Learn pages: how Nonograms work and a solving routine for beginners.
 */
import { gridDiagram } from './diagrams.mjs';

const clueExample = gridDiagram({
  rows: [[2, 1]],
  cols: [[1], [1], [0], [1], [0]],
  cells: [1, 1, -1, 1, -1],
  label: 'A row with clue 2 1: two filled cells, a gap, then one filled cell, then an empty cell.',
});

export const learnPages = [
  {
    path: 'learn/index.html',
    title: 'Learn',
    active: 'learn',
    description: 'Learn how Nonograms (Picross, Griddlers) work and how to solve them step by step.',
    body: `
<h1>Learn Nonograms</h1>
<p>A Nonogram is a picture puzzle. Numbers beside each row and column tell you where to color cells,
and the picture appears as you solve. No guessing is ever needed in a well-made puzzle.</p>
<div class="cards">
<a class="card" href="/learn/how-to-play/"><strong>How to play</strong><span>The rules, how to read clues, and the tools in the app.</span></a>
<a class="card" href="/learn/strategy/"><strong>A solving routine</strong><span>Where to start, what to look for next, and how to get unstuck.</span></a>
<a class="card" href="/techniques/"><strong>Technique guides</strong><span>Nine named techniques with diagrams, from easy to extreme.</span></a>
</div>
<p><a class="play-link" href="/play/">Open the app &rarr;</a></p>
`,
  },
  {
    path: 'learn/how-to-play/index.html',
    title: 'How to Play',
    active: 'learn',
    description: 'The rules of Nonograms, how to read the number clues, and how to use the tools in the app.',
    body: `
<p class="crumbs"><a href="/learn/">Learn</a> &rsaquo; How to play</p>
<h1>How to play</h1>
<h2>The goal</h2>
<p>Fill the grid so that every row and every column matches its clue numbers. The numbers give the
lengths of the runs of filled cells, in order, from left to right or top to bottom.</p>
<h2>Reading clues</h2>
<p>A clue of <strong>2 1</strong> means one run of two filled cells, then at least one empty cell, then
a run of one. A clue of <strong>0</strong> means the line is empty.</p>
<figure>${clueExample}<figcaption>One possible fit for a row clue of 2 1 in five cells.</figcaption></figure>
<h2>Two kinds of marks</h2>
<ul>
<li><strong>Filled</strong> cells are part of a run.</li>
<li><strong>Crossed-out</strong> cells are certainly empty. Crosses are your notes: they make later deductions easier.</li>
</ul>
<h2>In the app</h2>
<ul>
<li>Pick <strong>Fill</strong> or <strong>Cross</strong> in the toolbar, then click or drag across cells. Right-click always crosses.</li>
<li>A clue fades when its line already matches. That is a hint the line is finished, not a guarantee the rest of the board is right.</li>
<li><strong>Coach</strong> gives a hint in four steps, and <strong>Why?</strong> explains a single cell. See the <a href="/manual/">manual</a>.</li>
</ul>
<p><a class="play-link" href="/play/">Start a puzzle &rarr;</a></p>
`,
  },
  {
    path: 'learn/strategy/index.html',
    title: 'A Solving Routine',
    active: 'learn',
    description: 'A step-by-step routine for solving Nonograms without guessing.',
    body: `
<p class="crumbs"><a href="/learn/">Learn</a> &rsaquo; A solving routine</p>
<h1>A solving routine</h1>
<p>Work through these in order. When one stops giving you anything, move to the next, and go back to
the top whenever you make progress.</p>
<ol class="steps">
<li><strong>Start with the big clues.</strong> Lines whose clues nearly fill them have little slack. See
<a href="/techniques/full-zero-line/">Full Line &amp; Zero Line</a> and <a href="/techniques/simple-boxes/">Simple Boxes</a>.</li>
<li><strong>Cross out what cannot be reached.</strong> Crosses in one line become walls for the lines that cross it. See
<a href="/techniques/simple-spaces/">Simple Spaces</a>.</li>
<li><strong>Extend from edges and walls.</strong> A filled cell touching an edge or a cross often decides its whole block.
See <a href="/techniques/forcing/">Forcing</a> and <a href="/techniques/glue-puncturing/">Glue &amp; Puncturing</a>.</li>
<li><strong>Look at both directions.</strong> Switch between rows and columns often. Each new cell helps the crossing line.</li>
<li><strong>Join and split.</strong> Decide whether separate filled groups are one block or two.
See <a href="/techniques/joining-splitting/">Joining &amp; Splitting</a> and <a href="/techniques/mercury/">Mercury</a>.</li>
<li><strong>Only then, test a cell.</strong> Ask what would happen if it were filled. If a line breaks, the opposite is true.
See <a href="/techniques/edge-lookahead/">Edge Lookahead</a> and <a href="/techniques/contradiction/">Line Contradiction</a>.</li>
</ol>
<h2>Stuck?</h2>
<p>Press <strong>Coach</strong> in the app. The first hint only tells you where to look, so you can still
find the move yourself. Each further hint reveals more, until the last one shows the move.</p>
<p><a class="play-link" href="/play/">Practice now &rarr;</a></p>
`,
  },
];
