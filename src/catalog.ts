export type Category = 'flowers' | 'fillers' | 'wrappers' | 'ribbons' | 'effects';
export interface CatalogItem { id: string; name: string; note: string; color: string; }
const items = (rows: string[][]): CatalogItem[] => rows.map(([id, name, note, color]) => ({ id, name, note, color }));
export const catalog: Record<Category, CatalogItem[]> = {
  flowers: items([
    ['rose', 'Rose', 'A tiny romantic', '#e886a3'], ['tulip', 'Tulip', 'Soft little cups', '#dfa4d8'],
    ['daisy', 'Daisy', 'Simple sunshine', '#fff1dc'], ['sunflower', 'Sunflower', 'Main character energy', '#f0bb4b'],
    ['peony', 'Peony', 'Fluffy & fabulous', '#eaa6be'], ['lily', 'Lily', 'A graceful little star', '#efe7fb'],
    ['lavender', 'Lavender', 'Small, sweet & serene', '#aa93d2'], ['hydrangea', 'Hydrangea', 'A cloud of petals', '#9fbde0'],
    ['heart-bloom', 'Heart Bloom', 'Love on a stem', '#dc648c'], ['smiley-bloom', 'Smiley Bloom', 'Just happy to be here', '#f5cf66'],
  ]),
  fillers: items([
    ['babys-breath', 'Baby’s Breath', 'Little cloud sprigs', '#fff6e7'], ['eucalyptus', 'Eucalyptus', 'Round, soft leaves', '#89aaa0'],
    ['fern', 'Fern', 'Feathery fronds', '#6e9a79'], ['ruscus', 'Ruscus', 'Pointy little leaves', '#78a37a'],
    ['ivy', 'Ivy', 'Trailing heart leaves', '#6f9475'], ['wheat', 'Wheat Sprigs', 'Golden little grains', '#d5b475'],
    ['berries', 'Berry Sprigs', 'A pop of tiny berries', '#c87993'], ['bunny-tails', 'Bunny Tails', 'Fluffy cotton tails', '#ead7c6'],
    ['curly-grass', 'Curly Grass', 'A little happy wiggle', '#91ae76'], ['star-picks', 'Star Picks', 'A sprinkle of magic', '#ead087'],
  ]),
  wrappers: items([
    ['classic-cone', 'Classic Cone', 'The everyday cutie', '#e1bd94'], ['double-cone', 'Double-Layer Cone', 'Two lovely layers', '#d9b4d8'],
    ['scalloped', 'Scalloped Collar', 'A wavy little edge', '#efb5c2'], ['pleated', 'Pleated Fan', 'Folded with love', '#c4c2e5'],
    ['ruffled', 'Ruffled Tissue', 'Soft, frilly layers', '#ecc6d1'], ['origami', 'Origami Fold', 'A geometric hug', '#c9b5d9'],
    ['heart-collar', 'Heart Collar', 'Wrapped in hearts', '#e7a1b7'], ['petal-collar', 'Petal Collar', 'A flower for your flowers', '#c4d5ad'],
    ['gift-bag', 'Mini Gift Bag', 'A pocket of joy', '#d8bd9d'], ['frosted', 'Frosted Sleeve', 'Smooth pearly folds', '#c0d8df'],
  ]),
  ribbons: items([
    ['classic-bow', 'Classic Bow', 'A perfect little bow', '#b77ca8'], ['double-bow', 'Double Bow', 'Twice the cute', '#ce8ba5'],
    ['butterfly-bow', 'Butterfly Bow', 'Ready to flutter', '#b295d1'], ['rosette', 'Rosette Knot', 'A ribbon rose', '#ce8297'],
    ['satin-sash', 'Satin Sash', 'One sweeping ribbon', '#cda57a'], ['twine', 'Twine Tie', 'A rustic little knot', '#a88a66'],
    ['curly', 'Curly Ribbon', 'Party curls', '#d28fb5'], ['heart-knot', 'Heart Knot', 'A knot full of love', '#d17295'],
    ['star-knot', 'Star Knot', 'The finishing star', '#d8b76b'], ['long-tail', 'Long-Tail Bow', 'A little extra drama', '#a296c5'],
  ]),
  effects: items([
    ['sparkles', 'Sparkles', 'A soft twinkling halo', '#d8b86f'], ['hearts', 'Floating Hearts', 'Love is in the air', '#d985a5'],
    ['bubbles', 'Bubble Drift', 'Tiny iridescent orbits', '#b5cfe4'], ['petals', 'Falling Petals', 'A gentle petal shower', '#e6a3bf'],
    ['fireflies', 'Fireflies', 'A tiny dancing glow', '#dfcd7f'], ['butterflies', 'Butterflies', 'Little fluttering friends', '#bda0d7'],
    ['rainbow', 'Rainbow Halo', 'Your own little rainbow', '#d8a3bd'], ['confetti', 'Confetti Pop', 'Cue the celebration', '#c1a3d5'],
    ['starburst', 'Starburst', 'A happy burst of stars', '#e1bc68'], ['happy-faces', 'Happy-Face Pops', 'Ridiculously good vibes', '#eac465'],
  ]),
};
export const palettes = [
  { id: 'sugar', name: 'Sugar blush', colors: ['#e886a3', '#dfa4d8', '#fff1dc', '#b7c9ae', '#e1bd94', '#b77ca8'], background: '#f8ecef' },
  { id: 'sunshine', name: 'Peach please', colors: ['#f1ad7a', '#f0c65e', '#fff0d3', '#9bb58c', '#e2c392', '#d39174'], background: '#fff0df' },
  { id: 'lilac', name: 'Lilac daydream', colors: ['#b8a0d9', '#d6b4df', '#f0eafa', '#9eaeaf', '#c9c3e0', '#8c7bae'], background: '#efedf8' },
  { id: 'mint', name: 'Mint to be', colors: ['#a4cab6', '#bddbd2', '#f1e8cb', '#76a38a', '#c5d9c9', '#89b09c'], background: '#ebf3ed' },
  { id: 'berry', name: 'Berry sweet', colors: ['#d96c97', '#c799b9', '#eab9c9', '#789786', '#dfafbb', '#a75982'], background: '#f6e9ef' },
  { id: 'sky', name: 'Cloud nine', colors: ['#9bbce0', '#c2b4df', '#f4ecda', '#91b9b0', '#c4d9e2', '#839fc2'], background: '#eaf1f8' },
];
export function findItem(category: Category, id: string) { return catalog[category].find(item => item.id === id)!; }
