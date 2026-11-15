// The card: what pops up over everything (a job's surprise and how it went, the store's clerk). Its heading is an
// icon on a tile and a title; style.css, "a card that pops up", has the rest.

import exclamation from '@art/effects/exclamation.svg';

/** A pop-up's heading: its icon on the left, on the same tile every time, the title beside it. */
export function drawHead(icon: string, title: string): string {
  const tall = icon === exclamation ? ' tall' : ''; // the ! is drawn tight to its edges: give it room like the others
  return `<header class="card-head"><span class="card-icon${tall}"><img src="${icon}" alt="" /></span><h2 class="card-title">${title}</h2></header>`;
}
