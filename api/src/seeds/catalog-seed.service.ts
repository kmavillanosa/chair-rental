import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import { extname, join, posix } from 'path';
import { ItemType } from '../item-types/entities/item-type.entity';
import { ProductBrand } from '../brands/entities/product-brand.entity';

export interface CatalogSeedResult {
  itemTypesCreated: number;
  itemTypesUpdated: number;
  itemTypesDeactivated: number;
  brandsCreated: number;
  itemTypesWithSeededPictures: number;
  itemTypesMissingSeededPictures: number;
  itemTypesTotal: number;
  brandsTotal: number;
}

type CatalogProfile = {
  eventTags: string[];
  setTags: string[];
  brands: string[];
  defaultRatePerDay: number;
  matchers: Array<string | RegExp>;
};

type CatalogTypeVariant = {
  name: string;
  defaultRatePerDay: number;
  variantLabel?: string;
};

type SizeVariantRule = {
  matchers: Array<string | RegExp>;
  includeBaseType?: boolean;
  variants: Array<{
    suffix: string;
    rate?: number;
    rateDelta?: number;
  }>;
};

type ExtraItemTypeSeed = {
  name: string;
  defaultRatePerDay: number;
  eventTags: string[];
  setTags: string[];
};

const COMMON_EVENT_TAGS = [
  'birthday',
  'debut',
  'wedding',
  'funeral',
  'baptism',
  'anniversary',
  'corporate',
  'reunion',
  'graduation',
  'fiesta',
];

const TECH_EVENT_TAGS = [...COMMON_EVENT_TAGS, 'seminar', 'concert'];

const CATALOG_PROFILES: CatalogProfile[] = [
  {
    matchers: [
      'chair',
      'stool',
      'sofa',
      'ottoman',
      'monoblock',
      'chiavari',
      'ghost',
      'kids-chairs',
      'lounge-chairs',
      'picnic-chairs',
    ],
    defaultRatePerDay: 12,
    eventTags: COMMON_EVENT_TAGS,
    setTags: ['seating-set', 'table-set', 'reception-set', 'ceremony-set'],
    brands: [
      'Lifetime Products',
      'Mandaue Foam',
      'Uratex Monoblock',
      'Flash Furniture',
    ],
  },
  {
    matchers: ['table', 'buffet', 'coffee-table', 'kids-tables', 'picnic-tables'],
    defaultRatePerDay: 150,
    eventTags: COMMON_EVENT_TAGS,
    setTags: ['table-set', 'dining-set', 'buffet-set', 'reception-set'],
    brands: ['Lifetime Products', 'Iceberg Enterprises', 'COSCO', 'Correll'],
  },
  {
    matchers: ['tent', 'gazebo', 'pagoda', 'high-peak', 'retractable'],
    defaultRatePerDay: 3500,
    eventTags: TECH_EVENT_TAGS,
    setTags: ['tent-set', 'outdoor-set', 'booth-set', 'shelter-set'],
    brands: ['Eurmax', 'ABCCanopy', 'Mastertent', 'ShelterLogic'],
  },
  {
    matchers: [
      'stage',
      'runway',
      'catwalk',
      'dance-floor',
      'pipe-and-drape',
      'backdrop',
      'podium',
    ],
    defaultRatePerDay: 1800,
    eventTags: TECH_EVENT_TAGS,
    setTags: ['stage-set', 'program-set', 'performance-set'],
    brands: [
      'Staging Concepts',
      'Global Truss',
      'ProX Live Performance Gear',
      'Intellistage',
    ],
  },
  {
    matchers: [
      'speaker',
      'subwoofer',
      'amplifier',
      'audio-mixer',
      'microphone',
      'karaoke',
      'dj-controller',
      'monitor-speakers',
      'pa-speakers',
    ],
    // PH market: PA speaker pair ₱600–1,200/day, mixer ₱600–1,000, mic system ₱500–1,000
    defaultRatePerDay: 1000,
    eventTags: TECH_EVENT_TAGS,
    setTags: ['sound-set', 'dj-set', 'karaoke-set', 'program-set'],
    brands: ['JBL', 'QSC', 'Yamaha', 'Shure', 'Sennheiser', 'Behringer'],
  },
  {
    matchers: [
      'par-lights',
      'led-wash',
      'moving-head',
      'follow-spot',
      'laser',
      'disco-lights',
      'strobe',
      'string-lights',
      'chandelier',
      'light',
    ],
    // PH market: PAR/LED/disco light ₱150–300/unit; moving heads & follow spots get per-folder adjustments
    defaultRatePerDay: 350,
    eventTags: TECH_EVENT_TAGS,
    setTags: ['lighting-set', 'party-set', 'stage-set', 'ambience-set'],
    brands: ['Chauvet DJ', 'ADJ', 'Elation Lighting', 'Martin Professional'],
  },
  {
    matchers: [
      'led-wall',
      'projector',
      'projection-screen',
      'tvs-monitors',
      'camera',
      'livestream',
    ],
    defaultRatePerDay: 2000,
    eventTags: TECH_EVENT_TAGS,
    setTags: ['video-set', 'presentation-set', 'livestream-set'],
    brands: ['Epson', 'BenQ', 'Optoma', 'Samsung', 'LG'],
  },
  {
    matchers: [
      'chafing-dishes',
      'serving-trays',
      'plates',
      'forks-and-spoons',
      'glassware',
      'soup-bowls',
      'wine-glasses',
      'coffee-percolators',
      'water-dispensers',
    ],
    defaultRatePerDay: 180,
    eventTags: COMMON_EVENT_TAGS,
    setTags: ['catering-set', 'buffet-set', 'dining-set'],
    brands: ['Winco', 'Cambro', 'Vollrath'],
  },
  {
    matchers: ['industrial-fans', 'mist-fans', 'air-coolers', 'portable-air-conditioners'],
    defaultRatePerDay: 850,
    eventTags: TECH_EVENT_TAGS,
    setTags: ['cooling-set', 'comfort-set', 'outdoor-set'],
    brands: ['Iwata', 'Koppel', 'Dowell'],
  },
  {
    matchers: ['generator', 'extension-cords', 'power-distribution-boxes'],
    defaultRatePerDay: 1600,
    eventTags: TECH_EVENT_TAGS,
    setTags: ['power-set', 'event-essentials-set'],
    brands: ['Honda', 'Yamaha', 'Hyundai Power'],
  },
  {
    matchers: [
      'tablecloth',
      'chair-covers',
      'table-runners',
      'centerpieces',
      'artificial-flowers',
      'balloon-arches',
      'wedding-arches',
      'drapes',
    ],
    defaultRatePerDay: 140,
    eventTags: COMMON_EVENT_TAGS,
    setTags: ['decor-set', 'wedding-set', 'theme-set', 'styling-set'],
    brands: ['Events by Design', 'Party Supply Pro', 'Flora Event Decor'],
  },
  {
    matchers: ['smoke-machines', 'bubble-machines', 'snow-machines', 'confetti-machines', 'cryo-jets'],
    // PH market: smoke/bubble/confetti machines ₱400–800/day; cryo jets get per-folder +₱2,000
    defaultRatePerDay: 800,
    eventTags: TECH_EVENT_TAGS,
    setTags: ['effects-set', 'party-set', 'concert-set'],
    brands: ['Antari', 'Look Solutions', 'MagicFX'],
  },
];

const DEFAULT_PROFILE: CatalogProfile = {
  matchers: [],
  defaultRatePerDay: 250,
  eventTags: COMMON_EVENT_TAGS,
  setTags: ['event-essentials-set'],
  brands: ['Generic Event Supply'],
};

const SIZE_VARIANT_RULES: SizeVariantRule[] = [
  {
    matchers: ['folding-tables', 'foldable-tables', 'folding-table', 'foldable-table'],
    includeBaseType: false,
    variants: [
      { suffix: '4 ft', rate: 120 },
      { suffix: '6 ft', rate: 150 },
    ],
  },
  {
    matchers: ['rectangular-banquet-tables', 'rectangular-banquet'],
    includeBaseType: false,
    variants: [
      { suffix: '4 ft', rate: 180 },
      { suffix: '6 ft', rate: 250 },
      { suffix: '8 ft', rate: 320 },
    ],
  },
  {
    matchers: ['round-banquet-tables', 'round-banquet'],
    includeBaseType: false,
    variants: [
      { suffix: '4 ft', rate: 250 },
      { suffix: '5 ft', rate: 320 },
      { suffix: '6 ft', rate: 400 },
    ],
  },
];

@Injectable()
export class CatalogSeedService {
  // prettier-ignore
  private static readonly EXTRA_ITEM_TYPE_SEEDS: ExtraItemTypeSeed[] = [
    // --- Seating: additional chairs, stools & benches (30) ---
    { name: 'Crossback Chairs',                  defaultRatePerDay: 15,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set'] },
    { name: 'Americana Chairs',                  defaultRatePerDay: 15,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set'] },
    { name: 'Vineyard Chairs',                   defaultRatePerDay: 18,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set'] },
    { name: 'Phoenix Chairs',                    defaultRatePerDay: 18,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set'] },
    { name: 'Resin Folding Chairs',              defaultRatePerDay: 12,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set'] },
    { name: 'Gold Chiavari Chairs',              defaultRatePerDay: 45,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set', 'ceremony-set'] },
    { name: 'Silver Chiavari Chairs',            defaultRatePerDay: 45,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set', 'ceremony-set'] },
    { name: 'Black Chiavari Chairs',             defaultRatePerDay: 40,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set'] },
    { name: 'White Padded Banquet Chairs',       defaultRatePerDay: 20,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set', 'reception-set'] },
    { name: 'Black Padded Banquet Chairs',       defaultRatePerDay: 20,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set', 'reception-set'] },
    { name: 'Rattan Chairs',                     defaultRatePerDay: 25,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set', 'outdoor-set'] },
    { name: 'Bamboo Chairs',                     defaultRatePerDay: 22,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set', 'outdoor-set'] },
    { name: 'Wooden Rustic Chairs',              defaultRatePerDay: 25,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set'] },
    { name: 'Throne Chair (King)',               defaultRatePerDay: 500,   eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set', 'vip-set'] },
    { name: 'Throne Chair (Queen)',              defaultRatePerDay: 500,   eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set', 'vip-set'] },
    { name: 'Velvet Accent Chairs',              defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set', 'styling-set'] },
    { name: 'Love Seat Sofa',                    defaultRatePerDay: 450,   eventTags: COMMON_EVENT_TAGS, setTags: ['lounge-set', 'vip-set'] },
    { name: 'Garden Bench (Wooden)',             defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set', 'outdoor-set'] },
    { name: 'Pew Benches',                       defaultRatePerDay: 60,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set', 'ceremony-set'] },
    { name: 'Floor Cushions',                    defaultRatePerDay: 15,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set', 'outdoor-set'] },
    { name: 'Pouf Ottomans',                     defaultRatePerDay: 50,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set', 'lounge-set'] },
    { name: 'Kids Bean Bag Seats',               defaultRatePerDay: 25,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set', 'kids-set'] },
    { name: 'Sweetheart Chair (Bridal)',         defaultRatePerDay: 300,   eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set', 'ceremony-set'] },
    { name: 'Wicker Chairs',                     defaultRatePerDay: 28,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set', 'outdoor-set'] },
    { name: 'Acrylic Ghost Stools',              defaultRatePerDay: 50,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set'] },
    { name: 'Cross-Back Bar Stools',             defaultRatePerDay: 40,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set'] },
    { name: 'Folding Chairs (White)',            defaultRatePerDay: 12,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set', 'ceremony-set'] },
    { name: 'Folding Chairs (Black)',            defaultRatePerDay: 12,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set'] },
    { name: 'Banquet Chairs (Red)',              defaultRatePerDay: 22,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set'] },
    { name: 'Stack Chairs (Plastic)',            defaultRatePerDay: 10,    eventTags: COMMON_EVENT_TAGS, setTags: ['seating-set'] },
    // --- Tables: additional varieties (20) ---
    { name: 'Sweetheart Tables',                 defaultRatePerDay: 500,   eventTags: COMMON_EVENT_TAGS, setTags: ['table-set', 'ceremony-set'] },
    { name: 'Farm Tables (6 ft)',                defaultRatePerDay: 280,   eventTags: COMMON_EVENT_TAGS, setTags: ['table-set', 'dining-set'] },
    { name: 'Farm Tables (8 ft)',                defaultRatePerDay: 400,   eventTags: COMMON_EVENT_TAGS, setTags: ['table-set', 'dining-set'] },
    { name: 'Harvest Tables',                    defaultRatePerDay: 350,   eventTags: COMMON_EVENT_TAGS, setTags: ['table-set', 'dining-set'] },
    { name: 'Rustic Wood Tables',                defaultRatePerDay: 300,   eventTags: COMMON_EVENT_TAGS, setTags: ['table-set'] },
    { name: 'Marble-Top Tables',                 defaultRatePerDay: 500,   eventTags: COMMON_EVENT_TAGS, setTags: ['table-set', 'vip-set'] },
    { name: 'Cake Display Tables',               defaultRatePerDay: 200,   eventTags: COMMON_EVENT_TAGS, setTags: ['table-set', 'event-essentials-set'] },
    { name: 'Gift Tables',                       defaultRatePerDay: 150,   eventTags: COMMON_EVENT_TAGS, setTags: ['table-set', 'event-essentials-set'] },
    { name: 'Sign-In Registry Tables',           defaultRatePerDay: 150,   eventTags: COMMON_EVENT_TAGS, setTags: ['table-set', 'event-essentials-set'] },
    { name: 'Kids Activity Tables',              defaultRatePerDay: 100,   eventTags: COMMON_EVENT_TAGS, setTags: ['table-set', 'kids-set'] },
    { name: 'High-Top Tables (Counter Height)',  defaultRatePerDay: 180,   eventTags: COMMON_EVENT_TAGS, setTags: ['table-set'] },
    { name: 'Communal Long Tables',              defaultRatePerDay: 250,   eventTags: COMMON_EVENT_TAGS, setTags: ['table-set', 'dining-set'] },
    { name: 'Trestle Tables',                    defaultRatePerDay: 200,   eventTags: COMMON_EVENT_TAGS, setTags: ['table-set'] },
    { name: 'Oval Banquet Tables',               defaultRatePerDay: 280,   eventTags: COMMON_EVENT_TAGS, setTags: ['table-set', 'dining-set'] },
    { name: 'Half-Moon Tables',                  defaultRatePerDay: 220,   eventTags: COMMON_EVENT_TAGS, setTags: ['table-set', 'reception-set'] },
    { name: 'Serpentine Tables',                 defaultRatePerDay: 300,   eventTags: COMMON_EVENT_TAGS, setTags: ['table-set', 'buffet-set'] },
    { name: 'Mirrored Table Tops',               defaultRatePerDay: 400,   eventTags: COMMON_EVENT_TAGS, setTags: ['table-set', 'vip-set'] },
    { name: "King's Tables",                     defaultRatePerDay: 600,   eventTags: COMMON_EVENT_TAGS, setTags: ['table-set', 'ceremony-set'] },
    { name: 'Study / Training Tables',           defaultRatePerDay: 160,   eventTags: TECH_EVENT_TAGS,   setTags: ['table-set'] },
    { name: 'Registration Counter Tables',       defaultRatePerDay: 180,   eventTags: TECH_EVENT_TAGS,   setTags: ['table-set', 'event-essentials-set'] },
    // --- Tents & Structures (15) ---
    // PH market: stretch tent (medium) ₱4,000–8,000/day
    { name: 'Stretch Tents',                     defaultRatePerDay: 6000,  eventTags: COMMON_EVENT_TAGS, setTags: ['tent-set', 'outdoor-set'] },
    // PH market: Arabian tent ₱6,000–12,000/day
    { name: 'Arabian Tents',                     defaultRatePerDay: 8000,  eventTags: COMMON_EVENT_TAGS, setTags: ['tent-set', 'vip-set'] },
    // PH market: large luxury tent ₱8,000–15,000/day
    { name: 'Royal Tents',                       defaultRatePerDay: 10000, eventTags: COMMON_EVENT_TAGS, setTags: ['tent-set', 'vip-set'] },
    // PH market: 5m geodesic dome ₱5,000–10,000/day
    { name: 'Geodesic Dome Tents',               defaultRatePerDay: 8000,  eventTags: COMMON_EVENT_TAGS, setTags: ['tent-set', 'outdoor-set'] },
    { name: 'Marquee Tents',                     defaultRatePerDay: 5000,  eventTags: COMMON_EVENT_TAGS, setTags: ['tent-set', 'outdoor-set'] },
    // PH market: large clear-span structure ₱15,000–30,000/day
    { name: 'Clear-Span Structures',             defaultRatePerDay: 18000, eventTags: TECH_EVENT_TAGS,   setTags: ['tent-set', 'outdoor-set'] },
    { name: 'Sail Shade Tents',                  defaultRatePerDay: 4000,  eventTags: COMMON_EVENT_TAGS, setTags: ['tent-set', 'outdoor-set'] },
    { name: 'Safari Tents',                      defaultRatePerDay: 5500,  eventTags: COMMON_EVENT_TAGS, setTags: ['tent-set', 'outdoor-set'] },
    { name: 'Tunnel Connect Tents',              defaultRatePerDay: 3500,  eventTags: COMMON_EVENT_TAGS, setTags: ['tent-set', 'outdoor-set'] },
    { name: 'Hexagonal Tents',                   defaultRatePerDay: 5000,  eventTags: COMMON_EVENT_TAGS, setTags: ['tent-set', 'vip-set'] },
    { name: 'Transparent Tent Panels',           defaultRatePerDay: 1200,  eventTags: COMMON_EVENT_TAGS, setTags: ['tent-set'] },
    { name: 'Tent Flooring Systems',             defaultRatePerDay: 2000,  eventTags: COMMON_EVENT_TAGS, setTags: ['tent-set', 'outdoor-set'] },
    { name: 'Tent Sidewall Extensions',          defaultRatePerDay: 800,   eventTags: COMMON_EVENT_TAGS, setTags: ['tent-set', 'outdoor-set'] },
    { name: 'Tent Carpeting',                    defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['tent-set'] },
    { name: 'Tent Lighting Rigging',             defaultRatePerDay: 1500,  eventTags: COMMON_EVENT_TAGS, setTags: ['tent-set', 'lighting-set'] },
    // --- Wedding & Ceremony (20) ---
    { name: 'Wedding Arch (Wooden)',             defaultRatePerDay: 500,   eventTags: COMMON_EVENT_TAGS, setTags: ['ceremony-set', 'wedding-set'] },
    { name: 'Wedding Arch (Metal Circle)',       defaultRatePerDay: 400,   eventTags: COMMON_EVENT_TAGS, setTags: ['ceremony-set', 'wedding-set'] },
    { name: 'Wedding Arch (Metal Hexagon)',      defaultRatePerDay: 700,   eventTags: COMMON_EVENT_TAGS, setTags: ['ceremony-set', 'wedding-set'] },
    { name: 'Wedding Arch (Metal Square)',       defaultRatePerDay: 450,   eventTags: COMMON_EVENT_TAGS, setTags: ['ceremony-set', 'wedding-set'] },
    { name: 'Floral Wedding Arch',               defaultRatePerDay: 1200,  eventTags: COMMON_EVENT_TAGS, setTags: ['ceremony-set', 'wedding-set', 'decor-set'] },
    { name: 'Ceremony Aisle Runners',            defaultRatePerDay: 120,   eventTags: COMMON_EVENT_TAGS, setTags: ['ceremony-set'] },
    { name: 'Ceremony Columns',                  defaultRatePerDay: 400,   eventTags: COMMON_EVENT_TAGS, setTags: ['ceremony-set', 'decor-set'] },
    { name: 'Unity Candle Sets',                 defaultRatePerDay: 150,   eventTags: COMMON_EVENT_TAGS, setTags: ['ceremony-set', 'wedding-set'] },
    { name: 'Sand Ceremony Sets',                defaultRatePerDay: 150,   eventTags: COMMON_EVENT_TAGS, setTags: ['ceremony-set', 'wedding-set'] },
    { name: 'Memory Table Displays',             defaultRatePerDay: 300,   eventTags: COMMON_EVENT_TAGS, setTags: ['ceremony-set', 'event-essentials-set'] },
    { name: 'Guest Book Stands',                 defaultRatePerDay: 120,   eventTags: COMMON_EVENT_TAGS, setTags: ['event-essentials-set'] },
    { name: 'Wishing Well Boxes',                defaultRatePerDay: 180,   eventTags: COMMON_EVENT_TAGS, setTags: ['event-essentials-set'] },
    { name: 'Card Boxes (Acrylic)',              defaultRatePerDay: 180,   eventTags: COMMON_EVENT_TAGS, setTags: ['event-essentials-set'] },
    { name: '"Mr & Mrs" Signage',               defaultRatePerDay: 200,   eventTags: COMMON_EVENT_TAGS, setTags: ['wedding-set', 'event-essentials-set'] },
    { name: 'Head Table Garland',                defaultRatePerDay: 500,   eventTags: COMMON_EVENT_TAGS, setTags: ['wedding-set', 'decor-set'] },
    { name: 'Sweetheart Table Backdrop',         defaultRatePerDay: 800,   eventTags: COMMON_EVENT_TAGS, setTags: ['ceremony-set', 'wedding-set'] },
    { name: 'Flower Girl Baskets',               defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['wedding-set'] },
    { name: 'Coin Bearer Pillows',               defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['wedding-set', 'ceremony-set'] },
    { name: 'Arras Coin Sets (Display)',         defaultRatePerDay: 100,   eventTags: COMMON_EVENT_TAGS, setTags: ['wedding-set', 'ceremony-set'] },
    { name: 'Veil and Cord Sets (Display)',      defaultRatePerDay: 150,   eventTags: COMMON_EVENT_TAGS, setTags: ['wedding-set', 'ceremony-set'] },
    // --- Décor & Styling (35) ---
    { name: 'Marquee Letters (Large LED)',       defaultRatePerDay: 300,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'styling-set'] },
    { name: 'Giant Number Balloons',             defaultRatePerDay: 100,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'LED Neon Signs (Custom)',           defaultRatePerDay: 500,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'styling-set'] },
    { name: 'Photo Booth Frames (Standalone)',   defaultRatePerDay: 400,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'Selfie Wall Frames',                defaultRatePerDay: 500,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'Floral Walls (Artificial)',         defaultRatePerDay: 800,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'wedding-set', 'styling-set'] },
    { name: 'Greenery Walls',                    defaultRatePerDay: 700,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'styling-set'] },
    { name: 'Pampas Grass Arrangements',         defaultRatePerDay: 350,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'styling-set'] },
    { name: 'Ribbon Curtain Backdrops',          defaultRatePerDay: 250,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'Sequin Backdrop Curtains (Gold)',   defaultRatePerDay: 350,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'styling-set'] },
    { name: 'Sequin Backdrop Curtains (Silver)', defaultRatePerDay: 350,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'styling-set'] },
    { name: 'Fringe Backdrop Curtains',          defaultRatePerDay: 250,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'Balloon Columns',                   defaultRatePerDay: 200,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'Organza Drapes',                    defaultRatePerDay: 100,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'wedding-set'] },
    { name: 'Ceiling Drapes',                    defaultRatePerDay: 400,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'wedding-set'] },
    { name: 'Column Wraps',                      defaultRatePerDay: 50,    eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'Tall Floral Tower Stands',          defaultRatePerDay: 600,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'wedding-set'] },
    { name: 'Mercury Glass Vases',               defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'Geometric Terrarium Centerpieces',  defaultRatePerDay: 150,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'styling-set'] },
    { name: 'Floating Candle Bowls',             defaultRatePerDay: 60,    eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'Lantern Centerpieces',              defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'Succulent Centerpieces',            defaultRatePerDay: 120,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'Orchid Floral Arrangements',        defaultRatePerDay: 250,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'wedding-set'] },
    { name: 'Hanging Floral Installations',      defaultRatePerDay: 800,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'wedding-set'] },
    { name: 'Tree Branch Centerpieces',          defaultRatePerDay: 300,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'Rustic Mason Jar Arrangements',     defaultRatePerDay: 100,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'Giant Balloon Arches (Custom)',     defaultRatePerDay: 1500,  eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'Paper Pompom Decorations',          defaultRatePerDay: 40,    eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'Tissue Tassel Garlands',            defaultRatePerDay: 30,    eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'Photo Gallery Walls',               defaultRatePerDay: 500,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'styling-set'] },
    { name: 'Framed Photo Easels',               defaultRatePerDay: 100,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'Chalkboard Welcome Signs',          defaultRatePerDay: 120,   eventTags: COMMON_EVENT_TAGS, setTags: ['event-essentials-set'] },
    { name: 'Personalized Banner Stands',        defaultRatePerDay: 150,   eventTags: COMMON_EVENT_TAGS, setTags: ['event-essentials-set'] },
    { name: 'Balloon Letter Garlands',           defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'Bunting Banners',                   defaultRatePerDay: 50,    eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    // --- Candles & Lighting Accents (25) ---
    { name: 'Candelabras (Gold)',                defaultRatePerDay: 200,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'lighting-set'] },
    { name: 'Candelabras (Silver)',              defaultRatePerDay: 200,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'lighting-set'] },
    { name: 'Candelabras (Black)',               defaultRatePerDay: 200,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'lighting-set'] },
    { name: 'Pillar Candle Stands',              defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'Taper Candle Holders',              defaultRatePerDay: 40,    eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'Floating Candle Sets',              defaultRatePerDay: 50,    eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'LED Tea Light Candles (Set of 20)', defaultRatePerDay: 60,    eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'lighting-set'] },
    { name: 'Metal Lanterns',                    defaultRatePerDay: 60,    eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'Paper Lanterns',                    defaultRatePerDay: 30,    eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    { name: 'Moroccan Lanterns',                 defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'styling-set'] },
    { name: 'Fairy Lights (String)',             defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'lighting-set'] },
    { name: 'Globe String Lights',               defaultRatePerDay: 100,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'lighting-set'] },
    { name: 'Edison Bulb String Lights',         defaultRatePerDay: 120,   eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'lighting-set'] },
    { name: 'LED Canopy Lights',                 defaultRatePerDay: 180,   eventTags: COMMON_EVENT_TAGS, setTags: ['lighting-set'] },
    { name: 'Uplights (RGB)',                    defaultRatePerDay: 300,   eventTags: TECH_EVENT_TAGS,   setTags: ['lighting-set', 'party-set'] },
    { name: 'Uplights (White)',                  defaultRatePerDay: 250,   eventTags: COMMON_EVENT_TAGS, setTags: ['lighting-set', 'wedding-set'] },
    { name: 'Pin Spotlights',                    defaultRatePerDay: 200,   eventTags: COMMON_EVENT_TAGS, setTags: ['lighting-set'] },
    { name: 'Gobo Projectors',                   defaultRatePerDay: 800,   eventTags: COMMON_EVENT_TAGS, setTags: ['lighting-set', 'wedding-set'] },
    { name: 'Starfield Projectors',              defaultRatePerDay: 600,   eventTags: COMMON_EVENT_TAGS, setTags: ['lighting-set'] },
    { name: 'LED Strip Lights',                  defaultRatePerDay: 80,    eventTags: TECH_EVENT_TAGS,   setTags: ['lighting-set', 'party-set'] },
    { name: 'Neon Tube Lights',                  defaultRatePerDay: 200,   eventTags: TECH_EVENT_TAGS,   setTags: ['lighting-set', 'party-set'] },
    { name: 'Color-Changing Flood Lights',       defaultRatePerDay: 250,   eventTags: TECH_EVENT_TAGS,   setTags: ['lighting-set'] },
    { name: 'Spotlights (Single)',               defaultRatePerDay: 180,   eventTags: TECH_EVENT_TAGS,   setTags: ['lighting-set', 'stage-set'] },
    { name: 'LED Batten Lights',                 defaultRatePerDay: 120,   eventTags: TECH_EVENT_TAGS,   setTags: ['lighting-set'] },
    { name: 'Floodlight Stands',                 defaultRatePerDay: 100,   eventTags: TECH_EVENT_TAGS,   setTags: ['lighting-set', 'stage-set'] },
    // --- Signage & Stationery (10) ---
    { name: 'Welcome Sign Boards (Large)',       defaultRatePerDay: 150,   eventTags: COMMON_EVENT_TAGS, setTags: ['event-essentials-set'] },
    { name: 'Seating Chart Boards',              defaultRatePerDay: 200,   eventTags: COMMON_EVENT_TAGS, setTags: ['event-essentials-set'] },
    { name: 'Table Number Stands',               defaultRatePerDay: 30,    eventTags: COMMON_EVENT_TAGS, setTags: ['table-set', 'event-essentials-set'] },
    { name: 'Place Card Holders',                defaultRatePerDay: 15,    eventTags: COMMON_EVENT_TAGS, setTags: ['event-essentials-set'] },
    { name: 'Menu Display Boards',               defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['event-essentials-set'] },
    { name: 'Directional Sign Posts',            defaultRatePerDay: 100,   eventTags: COMMON_EVENT_TAGS, setTags: ['event-essentials-set'] },
    { name: 'Acrylic Sign Stands',               defaultRatePerDay: 150,   eventTags: COMMON_EVENT_TAGS, setTags: ['event-essentials-set'] },
    { name: 'Countdown Timer Displays',          defaultRatePerDay: 500,   eventTags: TECH_EVENT_TAGS,   setTags: ['event-essentials-set'] },
    { name: 'LED Message Boards',                defaultRatePerDay: 600,   eventTags: TECH_EVENT_TAGS,   setTags: ['event-essentials-set'] },
    { name: 'Registration Booths',               defaultRatePerDay: 1800,  eventTags: TECH_EVENT_TAGS,   setTags: ['event-essentials-set'] },
    // --- Entertainment & Photo (20) ---
    { name: 'Digital Photo Booth Kiosks',        defaultRatePerDay: 2000,  eventTags: COMMON_EVENT_TAGS, setTags: ['party-set', 'event-essentials-set'] },
    { name: 'Open-Air Photo Booth Setups',       defaultRatePerDay: 1500,  eventTags: COMMON_EVENT_TAGS, setTags: ['party-set'] },
    { name: '360 Photo Booth Platforms',         defaultRatePerDay: 3000,  eventTags: COMMON_EVENT_TAGS, setTags: ['party-set'] },
    { name: 'Magic Mirror Photo Booths',         defaultRatePerDay: 2500,  eventTags: COMMON_EVENT_TAGS, setTags: ['party-set'] },
    { name: 'Giant Jenga Game Sets',             defaultRatePerDay: 300,   eventTags: COMMON_EVENT_TAGS, setTags: ['party-set', 'outdoor-set'] },
    { name: 'Giant Connect Four Sets',           defaultRatePerDay: 250,   eventTags: COMMON_EVENT_TAGS, setTags: ['party-set', 'outdoor-set'] },
    { name: 'Cornhole Game Sets',                defaultRatePerDay: 200,   eventTags: COMMON_EVENT_TAGS, setTags: ['party-set', 'outdoor-set'] },
    { name: 'Lawn Bowling Sets',                 defaultRatePerDay: 200,   eventTags: COMMON_EVENT_TAGS, setTags: ['party-set', 'outdoor-set'] },
    { name: 'Bocce Ball Sets',                   defaultRatePerDay: 150,   eventTags: COMMON_EVENT_TAGS, setTags: ['party-set', 'outdoor-set'] },
    { name: 'Giant Chess Sets',                  defaultRatePerDay: 350,   eventTags: COMMON_EVENT_TAGS, setTags: ['party-set', 'outdoor-set'] },
    { name: 'Foosball Tables',                   defaultRatePerDay: 500,   eventTags: COMMON_EVENT_TAGS, setTags: ['party-set'] },
    { name: 'Air Hockey Tables',                 defaultRatePerDay: 600,   eventTags: COMMON_EVENT_TAGS, setTags: ['party-set'] },
    { name: 'Ping Pong Tables',                  defaultRatePerDay: 400,   eventTags: COMMON_EVENT_TAGS, setTags: ['party-set'] },
    { name: 'Giant Snakes and Ladders Sets',     defaultRatePerDay: 250,   eventTags: COMMON_EVENT_TAGS, setTags: ['party-set', 'kids-set'] },
    { name: 'Giant Tic-Tac-Toe Sets',            defaultRatePerDay: 200,   eventTags: COMMON_EVENT_TAGS, setTags: ['party-set', 'kids-set'] },
    { name: 'Giant Jenga (XL Outdoor)',          defaultRatePerDay: 500,   eventTags: COMMON_EVENT_TAGS, setTags: ['party-set', 'outdoor-set'] },
    { name: 'Ring Toss Game Sets',               defaultRatePerDay: 150,   eventTags: COMMON_EVENT_TAGS, setTags: ['party-set', 'kids-set'] },
    { name: 'Sack Race Kits',                    defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['party-set', 'kids-set'] },
    { name: 'Egg-and-Spoon Race Kits',           defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['party-set', 'kids-set'] },
    { name: 'Tug-of-War Ropes',                  defaultRatePerDay: 100,   eventTags: COMMON_EVENT_TAGS, setTags: ['party-set', 'outdoor-set'] },
    // --- Food & Beverage Equipment (20) ---
    { name: 'Cotton Candy Machines',             defaultRatePerDay: 600,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'party-set'] },
    { name: 'Popcorn Machines',                  defaultRatePerDay: 500,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'party-set'] },
    { name: 'Slushie Machines',                  defaultRatePerDay: 800,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'party-set'] },
    { name: 'Snow Cone Machines',                defaultRatePerDay: 600,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'party-set'] },
    { name: 'Chocolate Fountain Machines',       defaultRatePerDay: 1200,  eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'party-set'] },
    { name: 'Waffle Makers',                     defaultRatePerDay: 400,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set'] },
    { name: 'Crepe Makers',                      defaultRatePerDay: 400,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set'] },
    { name: 'Nacho Cheese Dispensers',           defaultRatePerDay: 350,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set'] },
    { name: 'Hot Dog Warmers',                   defaultRatePerDay: 300,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set'] },
    { name: 'Churro Machines',                   defaultRatePerDay: 450,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'party-set'] },
    { name: 'Popcorn Carts',                     defaultRatePerDay: 600,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'party-set'] },
    { name: 'Cotton Candy Carts',                defaultRatePerDay: 700,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'party-set'] },
    { name: 'Ice Cream Carts',                   defaultRatePerDay: 900,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'party-set'] },
    { name: 'Fondue Sets',                       defaultRatePerDay: 350,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set'] },
    { name: 'Cocktail Carts',                    defaultRatePerDay: 800,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set'] },
    { name: 'Lemonade Stands',                   defaultRatePerDay: 500,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'party-set'] },
    { name: "S'mores Kits (Outdoor)",            defaultRatePerDay: 300,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'outdoor-set'] },
    { name: 'Buffet Serving Carts',              defaultRatePerDay: 400,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'buffet-set'] },
    { name: 'Pancake Griddles',                  defaultRatePerDay: 350,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set'] },
    { name: 'Hot Pot Sets (Table Top)',          defaultRatePerDay: 600,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'dining-set'] },
    // --- Catering & Serviceware (15) ---
    { name: 'Beverage Dispensers',               defaultRatePerDay: 100,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'buffet-set'] },
    { name: 'Water Urns',                        defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set'] },
    { name: 'Coffee Urns',                       defaultRatePerDay: 150,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set'] },
    { name: 'Tea Urns',                          defaultRatePerDay: 120,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set'] },
    { name: 'Punch Bowls',                       defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'buffet-set'] },
    { name: 'Ice Buckets',                       defaultRatePerDay: 40,    eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set'] },
    { name: 'Wine Coolers',                      defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set'] },
    { name: 'Champagne Coolers',                 defaultRatePerDay: 100,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set'] },
    { name: 'Drink Dispensers on Stand',         defaultRatePerDay: 200,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'buffet-set'] },
    { name: 'Infused Water Dispensers',          defaultRatePerDay: 100,   eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set'] },
    { name: 'Juice Dispensers',                  defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set'] },
    { name: 'Serving Platters (Large)',          defaultRatePerDay: 50,    eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'buffet-set'] },
    { name: 'Gravy Boats',                       defaultRatePerDay: 25,    eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set'] },
    { name: 'Soup Tureens',                      defaultRatePerDay: 60,    eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'buffet-set'] },
    { name: 'Bread Baskets',                     defaultRatePerDay: 20,    eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set'] },
    // --- Tableware & Linens (15) ---
    { name: 'Charger Plates (Gold)',             defaultRatePerDay: 30,    eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'table-set'] },
    { name: 'Charger Plates (Silver)',           defaultRatePerDay: 30,    eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'table-set'] },
    { name: 'Charger Plates (Rose Gold)',        defaultRatePerDay: 30,    eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'table-set'] },
    { name: 'Charger Plates (Black)',            defaultRatePerDay: 25,    eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'table-set'] },
    { name: 'Dinner Plates (White Bone China)',  defaultRatePerDay: 15,    eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'dining-set'] },
    { name: 'Dessert Plates',                    defaultRatePerDay: 10,    eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set'] },
    { name: 'Napkin Rings (Silver)',             defaultRatePerDay: 8,     eventTags: COMMON_EVENT_TAGS, setTags: ['table-set'] },
    { name: 'Napkin Rings (Gold)',               defaultRatePerDay: 8,     eventTags: COMMON_EVENT_TAGS, setTags: ['table-set'] },
    { name: 'Cloth Napkins (White)',             defaultRatePerDay: 5,     eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'table-set'] },
    { name: 'Cloth Napkins (Colored)',           defaultRatePerDay: 6,     eventTags: COMMON_EVENT_TAGS, setTags: ['catering-set', 'table-set'] },
    { name: 'Satin Tablecloths',                 defaultRatePerDay: 100,   eventTags: COMMON_EVENT_TAGS, setTags: ['table-set', 'wedding-set'] },
    { name: 'Sequin Tablecloths (Gold)',         defaultRatePerDay: 180,   eventTags: COMMON_EVENT_TAGS, setTags: ['table-set', 'styling-set'] },
    { name: 'Sequin Tablecloths (Silver)',       defaultRatePerDay: 180,   eventTags: COMMON_EVENT_TAGS, setTags: ['table-set', 'styling-set'] },
    { name: 'Chair Sashes (White Satin)',        defaultRatePerDay: 10,    eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set', 'wedding-set'] },
    { name: 'Chair Sashes (Colored Organza)',    defaultRatePerDay: 10,    eventTags: COMMON_EVENT_TAGS, setTags: ['decor-set'] },
    // --- Outdoor & Venue (10) ---
    { name: 'Market Umbrellas',                  defaultRatePerDay: 250,   eventTags: COMMON_EVENT_TAGS, setTags: ['outdoor-set'] },
    { name: 'Patio Heaters',                     defaultRatePerDay: 400,   eventTags: COMMON_EVENT_TAGS, setTags: ['outdoor-set', 'comfort-set'] },
    { name: 'Garden Torches',                    defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['outdoor-set', 'decor-set'] },
    { name: 'Tiki Torches',                      defaultRatePerDay: 60,    eventTags: COMMON_EVENT_TAGS, setTags: ['outdoor-set', 'party-set'] },
    { name: 'Bamboo Torches',                    defaultRatePerDay: 50,    eventTags: COMMON_EVENT_TAGS, setTags: ['outdoor-set', 'party-set'] },
    { name: 'Red Carpet Runners',                defaultRatePerDay: 200,   eventTags: COMMON_EVENT_TAGS, setTags: ['event-essentials-set'] },
    { name: 'Stanchions with Velvet Rope',       defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['event-essentials-set'] },
    { name: 'Crowd Control Barriers',            defaultRatePerDay: 60,    eventTags: TECH_EVENT_TAGS,   setTags: ['event-essentials-set'] },
    { name: 'Event Barricades',                  defaultRatePerDay: 80,    eventTags: TECH_EVENT_TAGS,   setTags: ['event-essentials-set'] },
    { name: 'Outdoor Rugs (Large)',              defaultRatePerDay: 200,   eventTags: COMMON_EVENT_TAGS, setTags: ['outdoor-set'] },
    // --- Kids & Family Events (15) ---
    { name: 'Bounce Houses (Standard)',          defaultRatePerDay: 2000,  eventTags: COMMON_EVENT_TAGS, setTags: ['kids-set', 'party-set'] },
    { name: 'Bounce Houses (Castle)',            defaultRatePerDay: 2500,  eventTags: COMMON_EVENT_TAGS, setTags: ['kids-set', 'party-set'] },
    { name: 'Bounce Houses (Slide Combo)',       defaultRatePerDay: 3000,  eventTags: COMMON_EVENT_TAGS, setTags: ['kids-set', 'party-set'] },
    { name: 'Moon Bouncers',                     defaultRatePerDay: 1800,  eventTags: COMMON_EVENT_TAGS, setTags: ['kids-set', 'party-set'] },
    { name: 'Kids Soft Play Sets',               defaultRatePerDay: 1500,  eventTags: COMMON_EVENT_TAGS, setTags: ['kids-set', 'party-set'] },
    { name: 'Kids Obstacle Courses',             defaultRatePerDay: 2200,  eventTags: COMMON_EVENT_TAGS, setTags: ['kids-set', 'party-set'] },
    { name: 'Water Slide Inflatables',           defaultRatePerDay: 2500,  eventTags: COMMON_EVENT_TAGS, setTags: ['kids-set', 'outdoor-set'] },
    { name: 'Kiddie Pools',                      defaultRatePerDay: 300,   eventTags: COMMON_EVENT_TAGS, setTags: ['kids-set', 'outdoor-set'] },
    { name: 'Pinata Frames',                     defaultRatePerDay: 150,   eventTags: COMMON_EVENT_TAGS, setTags: ['kids-set', 'party-set'] },
    { name: 'Bubble Stations',                   defaultRatePerDay: 200,   eventTags: COMMON_EVENT_TAGS, setTags: ['kids-set', 'party-set'] },
    { name: 'Arts and Crafts Stations',          defaultRatePerDay: 400,   eventTags: COMMON_EVENT_TAGS, setTags: ['kids-set', 'party-set'] },
    { name: 'Face Painting Stations',            defaultRatePerDay: 300,   eventTags: COMMON_EVENT_TAGS, setTags: ['kids-set', 'party-set'] },
    { name: 'Giant Yard Stake Letters',          defaultRatePerDay: 200,   eventTags: COMMON_EVENT_TAGS, setTags: ['kids-set', 'decor-set'] },
    { name: "Kids' Balloon Twisting Kits",       defaultRatePerDay: 150,   eventTags: COMMON_EVENT_TAGS, setTags: ['kids-set', 'party-set'] },
    { name: 'Party Game Prize Stands',           defaultRatePerDay: 200,   eventTags: COMMON_EVENT_TAGS, setTags: ['kids-set', 'party-set'] },
    // --- Professional AV & Staging (20) ---
    { name: 'Wireless Presentation Clickers',    defaultRatePerDay: 80,    eventTags: TECH_EVENT_TAGS,   setTags: ['event-essentials-set'] },
    { name: 'Teleprompters',                     defaultRatePerDay: 1500,  eventTags: TECH_EVENT_TAGS,   setTags: ['stage-set', 'program-set'] },
    { name: 'Confidence Monitors (Presenter)',   defaultRatePerDay: 800,   eventTags: TECH_EVENT_TAGS,   setTags: ['stage-set'] },
    { name: 'Line Array Speaker Systems',        defaultRatePerDay: 5000,  eventTags: TECH_EVENT_TAGS,   setTags: ['sound-set', 'concert-set'] },
    { name: 'Delay Tower Speakers',              defaultRatePerDay: 1200,  eventTags: TECH_EVENT_TAGS,   setTags: ['sound-set'] },
    { name: 'Column Array PA Systems',           defaultRatePerDay: 2000,  eventTags: TECH_EVENT_TAGS,   setTags: ['sound-set'] },
    { name: 'Foldback Stage Monitors',           defaultRatePerDay: 600,   eventTags: TECH_EVENT_TAGS,   setTags: ['sound-set', 'stage-set'] },
    { name: 'Guitar Amplifiers',                 defaultRatePerDay: 500,   eventTags: TECH_EVENT_TAGS,   setTags: ['sound-set', 'stage-set'] },
    { name: 'Bass Amplifiers',                   defaultRatePerDay: 600,   eventTags: TECH_EVENT_TAGS,   setTags: ['sound-set', 'stage-set'] },
    { name: 'Keyboard Amplifiers',               defaultRatePerDay: 450,   eventTags: TECH_EVENT_TAGS,   setTags: ['sound-set', 'stage-set'] },
    { name: 'In-Ear Monitor Systems',            defaultRatePerDay: 800,   eventTags: TECH_EVENT_TAGS,   setTags: ['sound-set', 'stage-set'] },
    { name: 'DJ Booth Facades',                  defaultRatePerDay: 1500,  eventTags: TECH_EVENT_TAGS,   setTags: ['dj-set', 'stage-set'] },
    { name: 'Truss Systems (Lighting Rig)',      defaultRatePerDay: 3000,  eventTags: TECH_EVENT_TAGS,   setTags: ['stage-set', 'lighting-set'] },
    { name: 'Ground Support Systems',            defaultRatePerDay: 2500,  eventTags: TECH_EVENT_TAGS,   setTags: ['stage-set'] },
    { name: 'Stage Risers',                      defaultRatePerDay: 400,   eventTags: TECH_EVENT_TAGS,   setTags: ['stage-set', 'program-set'] },
    { name: 'Cable Ramps',                       defaultRatePerDay: 80,    eventTags: TECH_EVENT_TAGS,   setTags: ['stage-set', 'event-essentials-set'] },
    { name: 'Cable Covers',                      defaultRatePerDay: 50,    eventTags: TECH_EVENT_TAGS,   setTags: ['event-essentials-set'] },
    { name: 'Drum Shield Risers',                defaultRatePerDay: 400,   eventTags: TECH_EVENT_TAGS,   setTags: ['stage-set', 'sound-set'] },
    { name: 'Acoustic Panels (Temporary)',       defaultRatePerDay: 600,   eventTags: TECH_EVENT_TAGS,   setTags: ['stage-set'] },
    { name: 'Monitor Speaker Stands',            defaultRatePerDay: 150,   eventTags: TECH_EVENT_TAGS,   setTags: ['sound-set', 'stage-set'] },
    // --- Special Effects (10) ---
    { name: 'Dry Ice Machines',                  defaultRatePerDay: 800,   eventTags: COMMON_EVENT_TAGS, setTags: ['effects-set', 'party-set'] },
    { name: 'CO2 Cannons',                       defaultRatePerDay: 600,   eventTags: TECH_EVENT_TAGS,   setTags: ['effects-set', 'concert-set'] },
    { name: 'Powder Cannons',                    defaultRatePerDay: 300,   eventTags: COMMON_EVENT_TAGS, setTags: ['effects-set', 'party-set'] },
    { name: 'Flower Cannons',                    defaultRatePerDay: 250,   eventTags: COMMON_EVENT_TAGS, setTags: ['effects-set', 'party-set'] },
    { name: 'Cold Sparkler Machines',            defaultRatePerDay: 1500,  eventTags: COMMON_EVENT_TAGS, setTags: ['effects-set', 'party-set'] },
    { name: 'Glow Sticks (Pack of 100)',         defaultRatePerDay: 150,   eventTags: TECH_EVENT_TAGS,   setTags: ['effects-set', 'party-set'] },
    { name: 'Glow Bracelets (Pack of 100)',      defaultRatePerDay: 80,    eventTags: TECH_EVENT_TAGS,   setTags: ['effects-set', 'party-set'] },
    { name: 'Ribbon Wands (Pack of 50)',         defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['effects-set', 'ceremony-set'] },
    { name: 'Foam Party Equipment',              defaultRatePerDay: 1500,  eventTags: COMMON_EVENT_TAGS, setTags: ['effects-set', 'party-set'] },
    { name: 'Haze Machines',                     defaultRatePerDay: 600,   eventTags: TECH_EVENT_TAGS,   setTags: ['effects-set', 'stage-set'] },
    // --- Lounge & Furniture (10) ---
    { name: 'Cocktail Lounge Sets',              defaultRatePerDay: 1800,  eventTags: COMMON_EVENT_TAGS, setTags: ['lounge-set', 'vip-set'] },
    { name: 'Pallet Lounge Sets (Rustic)',       defaultRatePerDay: 1500,  eventTags: COMMON_EVENT_TAGS, setTags: ['lounge-set'] },
    { name: 'Boho Lounge Sets',                  defaultRatePerDay: 1200,  eventTags: COMMON_EVENT_TAGS, setTags: ['lounge-set', 'styling-set'] },
    { name: 'White Lounge Sets',                 defaultRatePerDay: 1600,  eventTags: COMMON_EVENT_TAGS, setTags: ['lounge-set', 'vip-set'] },
    { name: 'Rattan Lounge Sets',                defaultRatePerDay: 1400,  eventTags: COMMON_EVENT_TAGS, setTags: ['lounge-set', 'outdoor-set'] },
    { name: 'L-Shaped Modular Couches',          defaultRatePerDay: 2000,  eventTags: COMMON_EVENT_TAGS, setTags: ['lounge-set', 'vip-set'] },
    { name: 'Accent Coffee Table Sets',          defaultRatePerDay: 400,   eventTags: COMMON_EVENT_TAGS, setTags: ['lounge-set', 'table-set'] },
    { name: 'Display Pedestals',                 defaultRatePerDay: 150,   eventTags: COMMON_EVENT_TAGS, setTags: ['event-essentials-set'] },
    { name: 'Coat Racks',                        defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['event-essentials-set'] },
    { name: 'Registration Desks',                defaultRatePerDay: 500,   eventTags: TECH_EVENT_TAGS,   setTags: ['event-essentials-set'] },
    // --- Safety & Utilities (10) ---
    { name: 'First Aid Kits',                    defaultRatePerDay: 80,    eventTags: COMMON_EVENT_TAGS, setTags: ['event-essentials-set'] },
    { name: 'Fire Extinguishers (Event)',        defaultRatePerDay: 100,   eventTags: COMMON_EVENT_TAGS, setTags: ['event-essentials-set'] },
    { name: 'Hand Sanitizer Stations',           defaultRatePerDay: 60,    eventTags: COMMON_EVENT_TAGS, setTags: ['event-essentials-set'] },
    { name: 'Portable Toilets',                  defaultRatePerDay: 1200,  eventTags: COMMON_EVENT_TAGS, setTags: ['outdoor-set', 'event-essentials-set'] },
    { name: 'Portable Handwashing Stations',     defaultRatePerDay: 400,   eventTags: COMMON_EVENT_TAGS, setTags: ['outdoor-set', 'event-essentials-set'] },
    { name: 'Folding Trolleys',                  defaultRatePerDay: 100,   eventTags: COMMON_EVENT_TAGS, setTags: ['event-essentials-set'] },
    { name: 'Platform Dollies',                  defaultRatePerDay: 100,   eventTags: COMMON_EVENT_TAGS, setTags: ['event-essentials-set'] },
    // PH market: 2–3kva portable generator ₱800–1,200/day
    { name: 'Generators (Portable)',             defaultRatePerDay: 1000,  eventTags: COMMON_EVENT_TAGS, setTags: ['outdoor-set', 'power-set'] },
    { name: 'Power Strip Distributors',          defaultRatePerDay: 80,    eventTags: TECH_EVENT_TAGS,   setTags: ['power-set', 'event-essentials-set'] },
    { name: 'Cable Management Kits',             defaultRatePerDay: 60,    eventTags: TECH_EVENT_TAGS,   setTags: ['event-essentials-set'] },
  ];

  private static readonly IMAGE_EXTENSIONS = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.avif',
    '.gif',
  ]);

  private static readonly FOLDER_SUFFIX_WORDS = [
    'chairs',
    'chair',
    'tables',
    'table',
    'tents',
    'tent',
    'sofas',
    'sofa',
    'stools',
    'stool',
    'frames',
    'frame',
    'mixers',
    'mixer',
    'coolers',
    'cooler',
    'equipment',
    'lights',
    'light',
    'flowers',
    'flower',
  ];

  private static readonly EXCLUDED_UPLOAD_FOLDERS = new Set([
    'booking-documents',
  ]);

  private static readonly WORD_OVERRIDES: Record<string, string> = {
    pa: 'PA',
    dj: 'DJ',
    led: 'LED',
    vip: 'VIP',
    tvs: 'TVs',
    par: 'PAR',
    ac: 'AC',
  };

  private static readonly FOLDER_NAME_OVERRIDES: Record<string, string> = {
    'tiffany-chiavari': 'Tiffany / Chiavari',
    'tiffany-chiavari-chairs': 'Tiffany / Chiavari Chairs',
    'podium-lectern': 'Podium / Lectern',
    'runway-catwalk': 'Runway / Catwalk',
    'tvs-monitors': 'TVs / Monitors',
    'pa-speakers': 'PA Speakers',
    'pipe-and-drape-system': 'Pipe and Drape System',
  };

  private readonly uploadRootDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');

  constructor(
    @InjectRepository(ItemType)
    private readonly itemTypesRepo: Repository<ItemType>,
    @InjectRepository(ProductBrand)
    private readonly brandsRepo: Repository<ProductBrand>,
  ) {}

  async seed(): Promise<CatalogSeedResult> {
    let itemTypesCreated = 0;
    let itemTypesUpdated = 0;
    let itemTypesDeactivated = 0;
    let brandsCreated = 0;
    let itemTypesWithSeededPictures = 0;
    let itemTypesMissingSeededPictures = 0;
    const existingTypes = await this.itemTypesRepo.find();
    const itemTypeByName = new Map<string, ItemType>();

    for (const existingType of existingTypes) {
      itemTypeByName.set(existingType.name.trim().toLowerCase(), existingType);
    }

    const uploadFolders = this.getUploadFolders();
    const seededItemTypeNames = new Set<string>();
    const folderToTypeNames = new Map<string, string[]>();

    for (const folderName of uploadFolders) {
      const typeName = this.folderNameToTypeName(folderName);
      if (!typeName) continue;

      const profile = this.resolveProfile(folderName);
      const normalizedEventTags = this.normalizeTags(profile.eventTags);
      const normalizedSetTags = this.normalizeTags(profile.setTags);
      const seededPictureUrl = this.resolveSeedPictureUrl(typeName, folderName);
      const baseDefaultRatePerDay = this.resolveDefaultRatePerDay(
        folderName,
        profile.defaultRatePerDay,
      );
      const variants = this.resolveTypeVariants(
        folderName,
        typeName,
        baseDefaultRatePerDay,
      );

      const seededTypeNamesForFolder: string[] = [];

      for (const variant of variants) {
        const normalizedTypeName = variant.name.trim().toLowerCase();
        seededItemTypeNames.add(normalizedTypeName);
        seededTypeNamesForFolder.push(variant.name);

        const existingType = itemTypeByName.get(normalizedTypeName);
        const expectedDescription = variant.variantLabel
          ? `Seeded from uploads/${folderName} (${variant.variantLabel})`
          : `Seeded from uploads/${folderName}`;

        if (existingType) {
          const currentEventTags = this.normalizeTags(existingType.eventTags);
          const currentSetTags = this.normalizeTags(existingType.setTags);
          const shouldSyncPicture = Boolean(seededPictureUrl)
            && existingType.pictureUrl !== seededPictureUrl;

          const shouldUpdate =
            !this.sameTags(currentEventTags, normalizedEventTags)
            || !this.sameTags(currentSetTags, normalizedSetTags)
            || shouldSyncPicture
            || Number(existingType.defaultRatePerDay || 0) !== variant.defaultRatePerDay
            || existingType.description !== expectedDescription
            || existingType.isActive !== true;

          if (shouldUpdate) {
            existingType.eventTags = normalizedEventTags;
            existingType.setTags = normalizedSetTags;
            existingType.defaultRatePerDay = variant.defaultRatePerDay;
            existingType.description = expectedDescription;
            existingType.isActive = true;
            if (seededPictureUrl) {
              existingType.pictureUrl = seededPictureUrl;
            }
            await this.itemTypesRepo.save(existingType);
            itemTypesUpdated += 1;
          }

          if (seededPictureUrl || existingType.pictureUrl) {
            itemTypesWithSeededPictures += 1;
          } else {
            itemTypesMissingSeededPictures += 1;
          }

          continue;
        }

        const createdType = await this.itemTypesRepo.save(
          this.itemTypesRepo.create({
            name: variant.name,
            description: expectedDescription,
            defaultRatePerDay: variant.defaultRatePerDay,
            eventTags: normalizedEventTags,
            setTags: normalizedSetTags,
            pictureUrl: seededPictureUrl,
            isActive: true,
          }),
        );

        if (seededPictureUrl) {
          itemTypesWithSeededPictures += 1;
        } else {
          itemTypesMissingSeededPictures += 1;
        }

        itemTypesCreated += 1;
        itemTypeByName.set(normalizedTypeName, createdType);
      }

      folderToTypeNames.set(folderName, seededTypeNamesForFolder);
    }

    for (const extraSeed of CatalogSeedService.EXTRA_ITEM_TYPE_SEEDS) {
      const normalizedName = extraSeed.name.trim().toLowerCase();
      seededItemTypeNames.add(normalizedName);

      const normalizedEventTags = this.normalizeTags(extraSeed.eventTags);
      const normalizedSetTags = this.normalizeTags(extraSeed.setTags);
      const existingType = itemTypeByName.get(normalizedName);

      if (existingType) {
        const currentEventTags = this.normalizeTags(existingType.eventTags);
        const currentSetTags = this.normalizeTags(existingType.setTags);
        const shouldUpdate =
          !this.sameTags(currentEventTags, normalizedEventTags)
          || !this.sameTags(currentSetTags, normalizedSetTags)
          || Number(existingType.defaultRatePerDay || 0) !== extraSeed.defaultRatePerDay
          || existingType.isActive !== true;

        if (shouldUpdate) {
          existingType.eventTags = normalizedEventTags;
          existingType.setTags = normalizedSetTags;
          existingType.defaultRatePerDay = extraSeed.defaultRatePerDay;
          existingType.isActive = true;
          await this.itemTypesRepo.save(existingType);
          itemTypesUpdated += 1;
        }

        if (existingType.pictureUrl) {
          itemTypesWithSeededPictures += 1;
        } else {
          itemTypesMissingSeededPictures += 1;
        }
        continue;
      }

      const createdType = await this.itemTypesRepo.save(
        this.itemTypesRepo.create({
          name: extraSeed.name,
          description: 'Seeded catalog item type',
          defaultRatePerDay: extraSeed.defaultRatePerDay,
          eventTags: normalizedEventTags,
          setTags: normalizedSetTags,
          isActive: true,
        }),
      );

      itemTypeByName.set(normalizedName, createdType);
      itemTypesCreated += 1;
      itemTypesMissingSeededPictures += 1;
    }

    if (this.parseBooleanFlag(process.env.SEED_DEACTIVATE_MISSING_ITEM_TYPES)) {
      for (const existingType of existingTypes) {
        const normalizedName = existingType.name.trim().toLowerCase();
        if (seededItemTypeNames.has(normalizedName)) continue;
        if (!existingType.isActive) continue;

        await this.itemTypesRepo.update(existingType.id, { isActive: false });
        itemTypesDeactivated += 1;
      }
    }

    const existingBrands = await this.brandsRepo.find();
    const brandKeySet = new Set<string>();

    for (const existingBrand of existingBrands) {
      brandKeySet.add(this.toBrandKey(existingBrand.itemTypeId, existingBrand.name));
    }

    for (const folderName of uploadFolders) {
      const seededTypeNamesForFolder = folderToTypeNames.get(folderName) || [];
      if (!seededTypeNamesForFolder.length) continue;

      const profile = this.resolveProfile(folderName);
      for (const typeName of seededTypeNamesForFolder) {
        const itemType = itemTypeByName.get(typeName.trim().toLowerCase());
        if (!itemType) continue;

        for (const brandName of profile.brands) {
          const brandKey = this.toBrandKey(itemType.id, brandName);
          if (brandKeySet.has(brandKey)) continue;

          await this.brandsRepo.save(
            this.brandsRepo.create({
              itemTypeId: itemType.id,
              name: brandName,
              description: `Seeded brand for ${typeName}`,
            }),
          );

          brandsCreated += 1;
          brandKeySet.add(brandKey);
        }
      }
    }

    return {
      itemTypesCreated,
      itemTypesUpdated,
      itemTypesDeactivated,
      brandsCreated,
      itemTypesWithSeededPictures,
      itemTypesMissingSeededPictures,
      itemTypesTotal: await this.itemTypesRepo.count(),
      brandsTotal: await this.brandsRepo.count(),
    };
  }

  private resolveSeedPictureUrl(typeName: string, preferredFolderName?: string): string | undefined {
    if (!fs.existsSync(this.uploadRootDir)) return undefined;

    const folderName = preferredFolderName || this.resolveTypeImageFolder(typeName);
    if (!folderName) return undefined;

    const folderPath = join(this.uploadRootDir, folderName);
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      return undefined;
    }

    const imageFileName = this.pickImageFileName(folderPath);
    if (!imageFileName) return undefined;

    return posix.join('/uploads', folderName, imageFileName);
  }

  private getUploadFolders(): string[] {
    if (!fs.existsSync(this.uploadRootDir)) return [];

    return fs.readdirSync(this.uploadRootDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !CatalogSeedService.EXCLUDED_UPLOAD_FOLDERS.has(name))
      .sort((left, right) => left.localeCompare(right));
  }

  private folderNameToTypeName(folderName: string): string | null {
    const normalized = this.normalizeForPath(folderName);
    if (!normalized) return null;

    const explicitOverride = CatalogSeedService.FOLDER_NAME_OVERRIDES[normalized];
    if (explicitOverride) return explicitOverride;

    const words = normalized
      .split('-')
      .map((word) => word.trim())
      .filter(Boolean)
      .map((word) => CatalogSeedService.WORD_OVERRIDES[word] || this.capitalizeWord(word));

    if (!words.length) return null;
    return words.join(' ');
  }

  private capitalizeWord(word: string) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  private resolveProfile(folderName: string): CatalogProfile {
    const normalizedFolderName = this.normalizeForPath(folderName);
    for (const profile of CATALOG_PROFILES) {
      const matches = profile.matchers.some((matcher) => {
        if (typeof matcher === 'string') {
          return normalizedFolderName.includes(matcher);
        }
        return matcher.test(normalizedFolderName);
      });

      if (matches) {
        return profile;
      }
    }

    return DEFAULT_PROFILE;
  }

  private resolveDefaultRatePerDay(folderName: string, profileDefaultRate: number): number {
    const normalizedFolderName = this.normalizeForPath(folderName);
    let rate = profileDefaultRate;

    if (normalizedFolderName.includes('tent')) rate += 1200;           // PH large tent base ₱3,500+1,200=₱4,700
    if (normalizedFolderName.includes('air-conditioned')) rate += 1800; // AC tent premium
    if (normalizedFolderName.includes('generator')) rate += 900;        // 5kva gen: power ₱1,600+900=₱2,500
    if (normalizedFolderName.includes('led-wall')) rate += 1800;        // LED panel: video ₱2,000+1,800=₱3,800
    if (normalizedFolderName.includes('chandelier')) rate += 450;       // PH chandelier ₱600–1,200 (₱350+450=₱800)
    if (normalizedFolderName.includes('moving-head')) rate += 600;      // PH moving head ₱600–1,500 (₱350+600=₱950)
    if (normalizedFolderName.includes('follow-spot')) rate += 700;      // PH follow spot ₱800–1,500 (₱350+700=₱1,050)
    if (normalizedFolderName.includes('laser')) rate += 200;            // PH laser ₱400–800 (₱350+200=₱550)
    if (normalizedFolderName.includes('cryo')) rate += 2000;            // PH cryo jet ₱2,000–5,000 (₱800+2,000=₱2,800)
    if (normalizedFolderName.includes('wedding-arch')) rate += 300;     // PH wedding arch ₱300–600 (₱140+300=₱440)
    if (normalizedFolderName.includes('balloon-arch')) rate += 200;     // PH balloon arch ₱250–500 (₱140+200=₱340)
    if (normalizedFolderName.includes('backdrop')) rate -= 1400;        // PH backdrop frame ₱200–400 (₱1,800−1,400=₱400)
    if (normalizedFolderName.includes('podium')) rate -= 800;           // PH podium ₱500–1,000 (₱1,800−800=₱1,000)
    if (normalizedFolderName.includes('microphone')) rate -= 400;       // 2-ch wireless mic (₱1,000−400=₱600)
    if (normalizedFolderName.includes('extension-cords')) rate -= 1250; // PH drum reel ₱200–400 (₱1,600−1,250=₱350)
    if (normalizedFolderName.includes('forks-and-spoons')) rate -= 80;
    if (normalizedFolderName.includes('plates')) rate -= 100;

    return Math.max(50, Number(rate.toFixed(2)));
  }

  private resolveTypeVariants(
    folderName: string,
    baseTypeName: string,
    baseDefaultRatePerDay: number,
  ): CatalogTypeVariant[] {
    const normalizedFolderName = this.normalizeForPath(folderName);

    const matchedRule = SIZE_VARIANT_RULES.find((rule) =>
      rule.matchers.some((matcher) => this.matcherMatches(normalizedFolderName, matcher)),
    );

    if (!matchedRule) {
      return [
        {
          name: baseTypeName,
          defaultRatePerDay: baseDefaultRatePerDay,
        },
      ];
    }

    const variants: CatalogTypeVariant[] = matchedRule.variants.map((variant) => {
      const variantRate = Number(
        (
          variant.rate ??
          (baseDefaultRatePerDay + Number(variant.rateDelta || 0))
        ).toFixed(2),
      );

      return {
        name: `${baseTypeName} (${variant.suffix})`,
        defaultRatePerDay: Math.max(50, variantRate),
        variantLabel: variant.suffix,
      };
    });

    if (matchedRule.includeBaseType) {
      variants.unshift({
        name: baseTypeName,
        defaultRatePerDay: baseDefaultRatePerDay,
      });
    }

    return variants;
  }

  private matcherMatches(value: string, matcher: string | RegExp) {
    if (typeof matcher === 'string') {
      return value.includes(matcher);
    }

    return matcher.test(value);
  }

  private resolveTypeImageFolder(typeName: string): string | undefined {
    const entries = fs.readdirSync(this.uploadRootDir, { withFileTypes: true });
    const folderNames = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    if (folderNames.length === 0) return undefined;

    const normalizedFolderMap = new Map<string, string>();
    for (const folderName of folderNames) {
      normalizedFolderMap.set(this.normalizeForPath(folderName), folderName);
    }

    const folderCandidates = this.getTypeFolderCandidates(typeName);

    for (const candidate of folderCandidates) {
      const exactMatch = normalizedFolderMap.get(candidate);
      if (exactMatch) return exactMatch;
    }

    const fullSlug = this.normalizeForPath(typeName);
    for (const [normalizedFolderName, rawFolderName] of normalizedFolderMap) {
      if (
        fullSlug.startsWith(`${normalizedFolderName}-`)
        || normalizedFolderName.startsWith(`${fullSlug}-`)
      ) {
        return rawFolderName;
      }
    }

    return undefined;
  }

  private getTypeFolderCandidates(typeName: string): string[] {
    const fullSlug = this.normalizeForPath(typeName);
    const candidates = new Set<string>([fullSlug]);

    let trimmedSlug = fullSlug;
    for (const suffixWord of CatalogSeedService.FOLDER_SUFFIX_WORDS) {
      const suffix = `-${suffixWord}`;
      if (trimmedSlug.endsWith(suffix)) {
        trimmedSlug = trimmedSlug.slice(0, -suffix.length);
        if (trimmedSlug) {
          candidates.add(trimmedSlug);
        }
      }
    }

    return Array.from(candidates);
  }

  private pickImageFileName(folderPath: string): string | undefined {
    const fileNames = fs.readdirSync(folderPath)
      .filter((fileName) => {
        const extension = extname(fileName).toLowerCase();
        return CatalogSeedService.IMAGE_EXTENSIONS.has(extension);
      })
      .sort((left, right) => left.localeCompare(right));

    return fileNames[0];
  }

  private normalizeForPath(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private parseBooleanFlag(input: unknown) {
    const normalized = String(input || '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(normalized);
  }

  private toBrandKey(itemTypeId: string, brandName: string) {
    return `${itemTypeId}|${brandName.trim().toLowerCase()}`;
  }

  private normalizeTags(tags?: string[] | null): string[] {
    if (!Array.isArray(tags)) return [];
    return Array.from(
      new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean)),
    );
  }

  private sameTags(current: string[], next: string[]): boolean {
    if (current.length !== next.length) return false;
    return current.every((tag) => next.includes(tag));
  }
}